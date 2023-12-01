sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, Filter, FilterOperator, JSONModel) {
        "use strict";

        return Controller.extend("topdesk.controller.Home", {
            onInit: function () {
                this.viewModel = new JSONModel({ count: 0 });
                this.getOwnerComponent().setModel(this.viewModel, "view");

                this.byId("table").setBusy(true);
                let model = new JSONModel();
                this.getOwnerComponent().setModel(model, "tickets");

                let urlParams = new URLSearchParams();
                urlParams.set("pageSize", 100);
                urlParams.set("fields", "id, briefDescription, operator.name, processingStatus.name");
                urlParams.set("query", "(briefDescription=sw='C LMN',briefDescription=sw='I LMN');closed==false");

                model.loadData("/acorel/incidents", urlParams.toString())
                    .then(async () => {
                        let tickets = model.getData();

                        for (let ticket of tickets) {
                            ticket.number = ticket.briefDescription.substring(0, 11);
                            ticket.description = ticket.briefDescription.substring(12);

                            this.ticketLMN(ticket.number).then(ticketLMN => {
                                ticket.lmn = ticketLMN;
                                model.updateBindings();
                            });
                        }

                        model.setData(tickets);
                        this.byId("table").setBusy(false);

                        this.viewModel.setProperty("/count", tickets.length);
                        this.byId("table").getBinding("items").attachChange(this.onFilter.bind(this));
                    });
            },

            ticketLMN: async function (number) {
                let change = number.substring(0, 1) === "C";
                let backend = "/lmn" + (change ? "/operatorChanges/" : "/incidents/number/");
                let frontend = "https://lmn.topdesk.net/tas/secure/contained/" + (change ? "newchange" : "incident") + "?unid=";

                let model = new JSONModel();
                await model.loadData(backend + number);

                let ticket = model.getData();
                return {
                    id: ticket.id,
                    description: ticket.briefDescription,
                    status: change ? ticket.status.name : ticket.processingStatus.name,
                    operator: change ? ticket.simple.assignee.name : ticket.operator.name,
                    url: frontend + ticket.id
                };
            },

            onFilter: function (event) {
                this.viewModel.setProperty("/count", event.getSource()/* JSONListBinding */.getCount());
            },

            onSearch: function (event) {
                const value = event.getSource().getValue();
                const binding = this.byId("table").getBinding("items");
                if (!value) return binding.filter(null);

                binding.filter(new Filter({
                    filters: [
                        new Filter("number", FilterOperator.Contains, value),
                        new Filter("description", FilterOperator.Contains, value),
                        new Filter("operator/name", FilterOperator.Contains, value),
                        new Filter("processingStatus/name", FilterOperator.Contains, value),
                        new Filter("lmn/status", FilterOperator.Contains, value)
                    ],
                    and: false
                }));
            }
        });
    });
