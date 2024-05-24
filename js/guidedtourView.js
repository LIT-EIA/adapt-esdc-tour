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
      this.scrollToImageCenterBound = this.scrollToImageCenter.bind(this);
      this.listenTo(Adapt, 'device:changed', this.reRender);
    },
    reRender: function () {
      if (Adapt.device.screenSize !== 'large') {
        this.replaceWithNarrative();
      }
    },

    replaceWithNarrative: function () {
      this.stopListening(Adapt, 'device:resize', this.scrollToImageCenterBound);
      var NarrativeView = Adapt.getViewClass('narrative');

      var model = this.prepareNarrativeModel();
      var newNarrative = new NarrativeView({ model: model });
      var $container = $(".component-container", $("." + this.model.get("_parentId")));

      newNarrative.reRender();
      newNarrative.setupNarrative();
      $container.html(newNarrative.$el);
      //Adapt.trigger('device:resize');
      _.defer(this.remove.bind(this));
    },

    prepareNarrativeModel: function () {
      var model = this.model;
      model.set({
        '_component': 'narrative',
        '_wasGuidedtour': true,
        'originalBody': model.get('body'),
        'originalInstruction': model.get('instruction')
      });

      // Check if active item exists, default to 0
      var activeItem = model.getActiveItem();
      if (!activeItem) {
        model.getItem(0).toggleActive(true);
      }

      // Swap mobile body and instructions for desktop variants.
      if (model.get('mobileBody')) {
        model.set('body', model.get('mobileBody'));
      }
      if (model.get('mobileInstruction')) {
        model.set('instruction', model.get('mobileInstruction'));
      }

      return model;
    },

    checkIfResetOnRevisit: function () {
      var isResetOnRevisit = this.model.get('_isResetOnRevisit');

      // If reset is enabled set defaults
      if (isResetOnRevisit) {
        this.model.reset(isResetOnRevisit);
      }
    },

    preRender: function () {
      this.steps = this.model.get('_items');
      if (this.steps && this.steps.length >= 2) {
        this.model.set('active', true);
        this.steps.forEach(function (step) {
          var img = new Image();
          img.src = step._graphic.src;
        });
        const globals = Adapt.course.get('_globals');
        var guidedtour = globals._components._guidedtour;
        this.model.set('guidedtour', guidedtour);

        var componentModel = this.model;
        var blockModel = componentModel.get('_parent');
        var articleModel = blockModel.get('_parent');

        var models = [componentModel, blockModel, articleModel];
        var titleLevel = 1;

        models.forEach(function (model) {
          if (model.get('displayTitle').length >= 1) {
            titleLevel++;
          }
        })
        this.model.set('_ariaLevel', (titleLevel + 1))
      }

      if (Adapt.device.screenSize === 'large') {
        this.render();
      } else {
        this.reRender();
      }

    },

    postRender: function () {
      if (this.model.get('active')) {
        var guidedtour = this.model.get('guidedtour');
        this.componentID = this.$el.attr('data-adapt-id');

        this.tour = new Shepherd.Tour({
          defaultStepOptions: {
            cancelIcon: {
              enabled: true
            },
            scrollTo: false
          }
        });


        this.verifyCompletion = function () {
          if (Object.values(this.steps).every(step => step.inView === true)) {
            this.setCompletionStatus();
          }
        };

        this.previousStep = function (self, stepIndex) {
          this.$el.find('.loading-step').focus({ preventScroll: true });
          var step = this.steps[stepIndex];
          this.loadImage(step).then(() => {
            self.back();
          }
          );
        };

        this.nextStep = function (self, stepIndex) {
          this.$el.find('.loading-step').focus({ preventScroll: true });
          this.steps[stepIndex].inView = true;
          var step = this.steps[stepIndex];
          this.loadImage(step).then(() => {
            self.next();
          }
          );
        };

        this.loadImage = function (step) {
          return new Promise((resolve, reject) => {
            var self = this;
            const wrapper = this.$el.find('.guidedtour-graphic');
            const img = this.$el.find(`.guidedtour-graphic img`)[0];
            var fullWidth = step._graphic._forceFullWidth ? true : false;
            img.onload = () => {
              wrapper.toggleClass('full-width', fullWidth);
              self.scrollToImageCenterBound();
              resolve(img);
            }
            img.onerror = reject;
            img.src = step._graphic.src;
          })
        };

        var self = this;

        this.tour.on('cancel', function (e) {
          self.stopListening(Adapt, 'device:resize', self.scrollToImageCenterBound);
          self.loadImage(self.steps[0]).then(() => {
            self.$el.find('.guidedtour-graphic img').addClass('tour-disabled');
            self.$el.find('.start-tour').removeClass('display-none');
            self.verifyCompletion();
            self.$el.find('.start-tour').focus();
          })
        });

        this.tour.on('start', function (e) {
          self.listenTo(Adapt, 'device:resize', self.scrollToImageCenterBound);
        });

        this.steps.forEach(function (step, index) {

          var templateTitle = Handlebars.templates['stepTitle'];

          var templateOptions = {
            title: step.title,
            itemNumber: index + 1,
            totalItems: self.steps.length,
            ariaLevel: self.model.get('_ariaLevel'),
            hidePagination: self.model.get('_hidePagination')
          };

          var templatePagination = Adapt.course.get("_globals")._components._guidedtour.stepPagination || '{{itemNumber}} / {{totalItems}}';
          templateOptions.paginationLabel = Handlebars.compile(templatePagination)(templateOptions);

          var templatePaginationAria = Adapt.course.get("_globals")._components._guidedtour.stepPaginationAria || 'Step {{itemNumber}} of {{totalItems}}';
          templateOptions.paginationAria = Handlebars.compile(templatePaginationAria)(templateOptions);

          var stepObject = {
            title: templateTitle(templateOptions),
            text: `<img src="${step._graphic.src}" class="sr-only" alt="${step._graphic.alt}"/>${step.body}`,
            classes: !step._pin._bordercolor || step._pin._bordercolor === 'rgba(0, 0, 0, 0)' ? 'no-border' : 'border',
            buttons: [
              {
                action() {
                  return index === 0 ? self.tour.cancel() : self.previousStep(this, (index - 1));
                },
                classes: 'shepherd-button-secondary',
                text: index === 0 ? guidedtour.closeText : guidedtour.previousText
              },
              {
                action() {
                  return index === (self.steps.length - 1) ? self.tour.cancel() : self.nextStep(this, (index + 1));
                },
                text: index === (self.steps.length - 1) ? guidedtour.closeText : guidedtour.nextText
              }
            ],
            id: `step-${index}-${self.componentID}`,
            attachTo: {
              element: `div[data-adapt-id="${self.componentID}"] .tour-item-${index}`,
              on: step._pin._bubbledirection !== 'none' ? step._pin._bubbledirection : 'bottom'
            },
            arrow: step._pin._bubbledirection !== 'none',
            borderColor: step._pin._bordercolor,
            when: {
              show: function () {
                $(this.el).css(`--shepherd-border-color`, this.options.borderColor);
              }
            }
          }
          self.tour.addStep(stepObject);
        })
      }
      this.$('.guidedtour-widget').imageready(this.setReadyStatus.bind(this));
      if (this.model.get('_setCompletionOn') === 'inview') {
        this.setupInviewCompletion('.component-widget');
      }
    },

    remove: function () {
      if (this.model.get('active') && this.tour) {
        this.tour.complete();
      }
      Backbone.View.prototype.remove.call(this);
    },

    onStartTour: function () {
      this.scrollToImageCenterBound();
      this.steps[0].inView = true;
      var self = this;
      setTimeout(function () {
        self.$el.find('.start-tour').addClass('display-none');
        self.$el.find('.guidedtour-graphic img').removeClass('tour-disabled');
        self.tour.start();
      }, 300)
    },

    scrollToImageCenter: function () {
      var image = this.$el.find(`.guidedtour-graphic img`);
      var imagePosition = image.offset().top;
      var viewHeight = $(window).height() + $('.navigation').height();
      var imageHeight = image.height();
      var imageMiddle = imagePosition + (imageHeight / 2);
      var viewMiddle = (viewHeight / 2);
      var scrollToPosition = (imageMiddle - viewMiddle);
      window.scrollTo({top: scrollToPosition, behavior: 'smooth'});
    },

  });

  return GuidedTourView;

});
