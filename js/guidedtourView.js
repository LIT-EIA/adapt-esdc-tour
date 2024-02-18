define([
    'core/js/adapt',
    'core/js/views/componentView'
], function (Adapt, ComponentView) {
    'use strict';

    var GuidedTourView = ComponentView.extend({

        events: {
            'click .start-tour': 'onStartTour'
        },

        initialize: function () {
            ComponentView.prototype.initialize.call(this);
            this.checkIfResetOnRevisit();
        },

        checkIfResetOnRevisit: function () {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        preRender: function () {
            var _items = this.model.get('_items');
            this.model._items = _items.map(step => {
                if (step._pin._bubbledirection === 'center') {
                    step._pin._left = 50;
                    step._pin._top = 5;
                }
                return step;
            });
            this.render();
        },

        postRender: function () {
            this.componentID = this.$el.attr('data-adapt-id');
            this.steps = this.model.get('_items');

            this.tour = new Shepherd.Tour({
                defaultStepOptions: {
                    cancelIcon: {
                        enabled: true
                    },
                    classes: 'class-1 class-2',
                    scrollTo: false
                }
            });


            this.verifyCompletion = function () {
                if (Object.values(this.steps).every(step => step.inView === true)) {
                    this.setCompletionStatus();
                }
            }

            this.previousStep = function (self, stepIndex) {
                var step = this.steps[stepIndex];
                this.$el.find(`.guidedtour-graphic img`).attr('src', step._graphic.src);
                self.back();
            };

            this.nextStep = function (self, stepIndex) {
                this.steps[stepIndex].inView = true;
                var step = this.steps[stepIndex];
                this.$el.find(`.guidedtour-graphic img`).attr('src', step._graphic.src);
                self.next();
            };

            var self = this;


            this.tour.on('cancel', function (e) {
                self.$el.find('.guidedtour-graphic img').attr('src', self.steps[0]._graphic.src);
                self.$el.find('.guidedtour-graphic img').addClass('tour-disabled');
                self.$el.find('.start-tour').removeClass('display-none');
                self.verifyCompletion();
            });

            this.steps.forEach(function (step, index) {
                var stepObject = {
                    title: step.title,
                    text: step.body,
                    buttons: [
                        {
                            action() {
                                return index === 0 ? self.tour.cancel() : self.previousStep(this, (index - 1));
                            },
                            classes: 'shepherd-button-secondary',
                            text: index === 0 ? 'Close' : 'Back'
                        },
                        {
                            action() {
                                return index === (self.steps.length - 1) ? self.tour.cancel() : self.nextStep(this, (index + 1));
                            },
                            text: index === (self.steps.length - 1) ? 'Close' : 'Next'
                        }
                    ],
                    id: `step-${index}-${self.componentID}`
                }

                if (step._pin._bubbledirection !== 'center') {
                    stepObject.attachTo = {
                        element: `div[data-adapt-id="${self.componentID}"] .tour-item-${index}`,
                        on: step._pin._bubbledirection
                    }
                } else {
                    stepObject.attachTo = {
                        element: `div[data-adapt-id="${self.componentID}"] .tour-item-${index}`,
                        on: 'bottom'
                    }
                    stepObject.arrow = false
                }

                self.tour.addStep(stepObject);
            })
            this.$('.guidedtour-widget').imageready(this.setReadyStatus.bind(this));
            if (this.model.get('_setCompletionOn') === 'inview') {
                this.setupInviewCompletion('.component-widget');
            }
        },

        onStartTour: function () {
            this.$el.parents('.block-inner')[0].scrollIntoView({ block: "end", behavior: "smooth" });
            this.steps[0].inView = true;
            var self = this;
            setTimeout(function () {
                self.$el.find('.start-tour').addClass('display-none');
                self.$el.find('.guidedtour-graphic img').removeClass('tour-disabled');
                self.tour.start();
            }, 300)
        }

    });

    return GuidedTourView;

});
