var angular = require('angular');
var templateUrl = require('ngtemplate-loader!./booking.component.html');

//Creating bookingPage component on StickyBooking Module
angular.module('StickyBooking')
    .component('bookingPage', {
        templateUrl: templateUrl,
        controller: function BookingController($scope, $http, occasionSDKService) {

          //Runs On Init
          this.$onInit = function(){
            console.log("Booking Component Init");
            //Call function to load data from SDK Service
            $scope.displayLoading = true;
            $scope.initialDataLoaded = false;
            $scope.calendarDataLoaded = false;
            $scope.orderLoaded = false;
            $scope.staticProductID = window.OCCSN.product_id;
            //Test purchase details
            $scope.card = {
              number: null,
              month: null,
              year: null,
              verification: null
            }
            $scope.loadSDKData();
          }

          //Make initial calls for data and subsequent eager loaded calls
          $scope.loadSDKData = function(){
            $scope.merchant = null;
            $scope.product = null;

            //Initiate several promises at once, wait for all of them to respond before continuing
            Promise.all([
              occasionSDKService.getMyMerchant(),
              occasionSDKService.getProductById($scope.staticProductID)
            ]).then( (values) => {
              console.log("Promise.All Finished", values);

            //Populate global variables with returns from promises above
            $scope.merchant = values[0];
            $scope.product = values[1];

            $scope.psp = $scope.merchant.pspName;
            console.log("PSP:", $scope.psp);

            //Manually refresh DOM
            $scope.$emit('initialDataLoaded', { product: $scope.product } );
            $scope.initialDataLoaded = true;
            $scope.displayLoading = false;
            $scope.$apply();

            //Eager load calendar data
            console.log("Calendar data loading");
            occasionSDKService.getTimeSlotsForProduct($scope.product)
            .then( (timeSlots) => {
              $scope.timeSlots = timeSlots;

            occasionSDKService.getTimeSlotsByMonth( $scope.timeSlots, new Date($scope.timeSlots.__collection[0].startsAt).getMonth() )
            .then( (timeSlotsByMonth) => {
              $scope.timeSlots = timeSlotsByMonth;

            //Find all possible durations
            $scope.durations = [];
            $scope.timeSlots.map( (timeSlot) => {
              if($scope.durations.indexOf(timeSlot.attributes().duration) == -1){
              $scope.durations.push(timeSlot.attributes().duration);
            }
          });

            //Manually refresh DOM
            console.log("Calendar data loaded");
            $scope.calendarDataLoaded = true;
            $scope.$apply();

            //Pass data to child components and initiate their processing
            $scope.$broadcast('timeSlotDataLoaded', {
              merchant: $scope.merchant,
              product: $scope.product,
              timeSlots: $scope.timeSlots,
              durations: $scope.durations
            });
          })
          .catch( (error) => console.log(error) );
          });

            //Eager load Order resource
            console.log("Order data loading");
            occasionSDKService.createOrderForProduct($scope.product)
            .then( (order) => {
              console.log("Order data loaded");
            $scope.order = order;
            $scope.orderLoaded = true;
          });

          }).catch( (error) => console.log(error) );
          }

          //When a user clicks get started
          $scope.getStarted = function(){
            if($scope.calendarDataLoaded){
              //Scroll Calendar into view
              $(".pane-calendar").fadeIn();
              $scope.scrollToAnchor('step-1-scroller');
              $("#booking-process-status .booking-step-1").addClass("booking-step-complete").removeClass("booking-step-active");
              $("#booking-process-status .booking-step-2").addClass("booking-step-active");
            }else{
              $scope.displayLoading = true;
              $scope.$watch('calendarDataLoaded', function(newValue, oldValue, scope){
                if(newValue == true){
                  $scope.displayLoading = false;
                  //Scroll Calendar into view
                  $(".pane-calendar").fadeIn();
                  $scope.scrollToAnchor('step-1-scroller');
                  $("#booking-process-status .booking-step-1").addClass("booking-step-complete").removeClass("booking-step-active");
                  $("#booking-process-status .booking-step-2").addClass("booking-step-active");
                }
              });
            }
          }

          //When date is selected from calendar
          $scope.$on('dateSelectedEvent', function(event, data){
            $scope.friendlyDate = data.friendlyDate;
            $scope.selectedDate = data.selectedDate;
            $scope.selectedDateElement = data.selectedDateElement;

            $scope.availableSlots = [];
            $scope.timeSlots.map( (timeSlot) => {
              if( $scope.sameDay( new Date(timeSlot.startsAt), new Date($scope.selectedDate.stringDate) )){
              $scope.availableSlots.push(timeSlot);
            }
          });
            $scope.availableSlots.sort(function(a,b){
              return new Date(b.startsAt) - new Date(a.startsAt);
            });
            $scope.availableSlots.reverse();
          });

          //When new time slots are loaded
          $scope.$on('timeSlotsUpdated', function(event, data){
            $scope.timeSlots = data.timeSlots;
            $scope.displayLoading = false;
            $scope.$apply();
          });

          //When loading animation is started from sub component
          $scope.$on("startLoading", function(event){
            $scope.displayLoading = true;
          });

          //When loading animation is stopped from sub component
          $scope.$on("stopLoading", function(event){
            $scope.displayLoading = false;
          });

          //When time slot is selected
          $scope.onTimeSlotSelection = function(event, passTime){
            event.preventDefault();
            let time = passTime;
            $scope.selectedTimeSlot = time;
            $scope.selectedTimeSlotElement = event.currentTarget;
            $(".time-slot-buttons button").removeClass("time-slot-active");
            $scope.selectedTimeSlotElement.className += " time-slot-active";

            $scope.order.timeSlots().target().push($scope.selectedTimeSlot);

            if($scope.orderLoaded){
              $scope.startOrder();
            }else{
              $scope.displayLoading = true;
              $scope.$watch('orderLoaded', function(newValue, oldValue, scope){
                if(newValue){
                  $scope.displayLoading = false;
                  $scope.startOrder();
                }
              });
            }
          }

          //When Order and Answers must be configured
          $scope.startOrder = function(){

            $scope.optionsHolder = {};

            //Set default values
            $scope.order.answers().target().map( (answer) => {

              var formControl = answer.question().formControl;
            var optionCount = 0;
            var firstOption = null;
            var defaultFound = false;
            answer.question().options().target().map( (option) => {

              if(optionCount == 0){
              firstOption = option;
            }

            if(formControl == 'drop_down' || formControl == 'option_list'){
              if(option.default){
                if(formControl == 'drop_down')
                  $scope.optionsHolder[answer.question().id] = option.id;
                if(formControl == 'option_list')
                  $scope.optionsHolder[answer.question().id] = option.title;
                defaultFound = true;
                answer.assignOption(option);
              }
            }

            optionCount++;
          });

            if( (formControl == 'drop_down' || formControl == 'option_list') && !defaultFound){
              if(formControl == 'drop_down')
                $scope.optionsHolder[answer.question().id] = firstOption.id;
              if(formControl == 'option_list')
                $scope.optionsHolder[answer.question().id] = firstOption.title;
              answer.assignOption(firstOption);
            }

            if(formControl == 'checkbox'){
              answer.value = false;
            }
          });

            //Scroll into customer info pane and hide the animation spinner
            $('.pane-customer-information').addClass("step-visible");
            $("#booking-process-status .booking-step-3").addClass("booking-step-complete").removeClass("booking-step-active");
            $("#booking-process-status .booking-step-4").addClass("booking-step-active");
            $scope.scrollToAnchor('customer-info-pane-scroller');

            //Calculate starting price
            $scope.order.calculatePrice()
            .then( (order) => {
              console.log("Order after first calc", $scope.order.attributes());
            $scope.$apply();

            if($scope.psp == "spreedly"){
              console.log("Use Spreedly");
              $scope.useSpreedly();
            }

            if($scope.psp == "square"){
              console.log("Use Square");
              $scope.useSquare();
            }
          })
          .catch( (error) => {
              console.log("Error from calc start price", error);
          });
          }

          $scope.useSquare = function() {
            // Set the application ID
            //var applicationId = "sandbox-sq0idp-uLNY74KK3HbAKyORsoR3_g"; //Marc's Sandbox Key
            var applicationId = "sq0idp-kKdgouNdlT2lj08V0tSJ3g"; //OCCASION's Key

            // Set the location ID
            var locationId = "CBASEPCUENvvoTglXMqmVTIUaUwgAQ";

            // Create and initialize a payment form object
            $scope.paymentForm = new SqPaymentForm({

              // Initialize the payment form elements
              applicationId: applicationId,
              locationId: locationId,
              inputClass: 'form-control',

              applePay: false,
              masterpass: false,

              // Customize the CSS for SqPaymentForm iframe elements
              inputStyles: [{
                fontSize: '19px'
              }],

              // Initialize Apple Pay placeholder ID
              applePay: {
                elementId: 'sq-apple-pay'
              },

              // Initialize Masterpass placeholder ID
              masterpass: {
                elementId: 'sq-masterpass'
              },

              // Initialize the credit card placeholders
              cardNumber: {
                elementId: 'sq-card-number',
                placeholder: '•••• •••• •••• ••••'
              },
              cvv: {
                elementId: 'sq-cvv',
                placeholder: 'CVV'
              },
              expirationDate: {
                elementId: 'sq-expiration-date',
                placeholder: 'MM/YY'
              },
              postalCode: {
                elementId: 'sq-postal-code',
                placeholder: '#####'
              },

              // SqPaymentForm callback functions
              callbacks: {
                methodsSupported: function (methods) {
                  var applePayBtn = document.getElementById('sq-apple-pay');
                  var applePayLabel = document.getElementById('sq-apple-pay-label');
                  var masterpassBtn = document.getElementById('sq-masterpass');
                  var masterpassLabel = document.getElementById('sq-masterpass-label');

                  applePayBtn.style.display = 'none';
                  applePayLabel.style.display = 'none';
                  masterpassBtn.style.display = 'none';
                  masterpassLabel.style.display = 'none';
                  // Only show the button if Apple Pay for Web is enabled
                  // Otherwise, display the wallet not enabled message.
                  /*if (methods.applePay === true) {
                      applePayBtn.style.display = 'inline-block';
                      applePayLabel.style.display = 'none' ;
                  }
                  // Only show the button if Masterpass is enabled
                  // Otherwise, display the wallet not enabled message.
                  if (methods.masterpass === true) {
                      masterpassBtn.style.display = 'inline-block';
                      masterpassLabel.style.display = 'none';
                  }*/
                },
                createPaymentRequest: function () {
                  var paymentRequestJson ;
                  return paymentRequestJson ;
                },
                cardNonceResponseReceived: function(errors, nonce, cardData) {
                  if (errors) {
                    console.log("Encountered errors:");
                    errors.forEach(function(error) {
                      console.log('  ' + error.message);
                    });
                  }else{
                    console.log('Nonce received: ', nonce);

                    var creditCard = occasionSDKService.buildCard({ id: nonce});

                    console.log("Credit Card", creditCard);

                    $scope.order.charge( creditCard, $scope.order.outstandingBalance );

                    $scope.order.calculatePrice()
                    .then( (order) => {
                      $scope.submitOrder();
                  })
                  .catch( (error) => {
                      console.log("Errors with final calc price", error);
                  });
                  }
                },
                unsupportedBrowserDetected: function() {},
                inputEventReceived: function(inputEvent) {
                  switch (inputEvent.eventType) {
                    case 'focusClassAdded':
                      /* HANDLE AS DESIRED */
                      break;
                    case 'focusClassRemoved':
                      /* HANDLE AS DESIRED */
                      break;
                    case 'errorClassAdded':
                      /* HANDLE AS DESIRED */
                      break;
                    case 'errorClassRemoved':
                      /* HANDLE AS DESIRED */
                      break;
                    case 'cardBrandChanged':
                      /* HANDLE AS DESIRED */
                      break;
                    case 'postalCodeChanged':
                      /* HANDLE AS DESIRED */
                      break;
                  }
                },
                paymentFormLoaded: function() {
                  console.log("Form loaded");
                }
              }
            });
            $scope.paymentForm.build();
          }

          $scope.requestCardNonce = function(event) {
            event.preventDefault();
            $scope.paymentForm.requestCardNonce();
          }

          $scope.useSpreedly = function(){
            //Init Spreedly card values
            Spreedly.init("UnQhm0g7l3nOIz2hmAoV3eqm26k", {
              "numberEl": "spreedly-number",
              "cvvEl": "spreedly-cvv"
            });

            Spreedly.on("ready", function () {
              var submitButton = document.getElementById('submit-button');
              submitButton.disabled = false;
              Spreedly.setFieldType("number", "text");
              Spreedly.setNumberFormat("prettyFormat");
              Spreedly.setPlaceholder("number", "Card Number");
              Spreedly.setPlaceholder("cvv", "CVV");
              Spreedly.setStyle("number", 'display: block; width: 95%; height: 36px; padding: 6px 12px; font-size: 16px; line-height: 1.428571429; color: #7b829a; background-color: #fff; background-image: none; border: 1px solid #ccc; -webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); -webkit-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; -o-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;');
              Spreedly.setStyle("cvv", 'display: block; width: 60px; height: 36px; padding: 6px 12px; font-size: 16px; line-height: 1.428571429; color: #7b829a; background-color: #fff; background-image: none; border: 1px solid #ccc; -webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); -webkit-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; -o-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;');
            });

            Spreedly.on('fieldEvent', function(name, type, activeEl, inputProperties) {
              if(type == 'focus'){
                Spreedly.setStyle(name,'border-color: #66afe9; outline: 0; -webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(102, 175, 233, 0.6); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(102, 175, 233, 0.6)');
              }
              if(type == 'blur'){
                Spreedly.setStyle(name, 'border: 1px solid #ccc; -webkit-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075); -webkit-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; -o-transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s; transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;');
              }
            });

            Spreedly.on('errors', function(errors) {
              for (var i=0; i < errors.length; i++) {
                var error = errors[i];
                console.log(error);
              };
            });

            Spreedly.on('paymentMethod', function(token, pmData) {
              console.log("Card Token", token);
              console.log("pmData", pmData);

              var creditCard = occasionSDKService.buildCard(token);

              console.log("Credit Card", creditCard);

              console.log("outstanding before charge", $scope.order.outstandingBalance);

              $scope.order.charge( creditCard, $scope.order.outstandingBalance );

              console.log("outstanding after charge but before calc price", $scope.order.outstandingBalance);

              $scope.order.calculatePrice()
              .then( (order) => {
                console.log("Order attributes after charge", $scope.order.attributes());
              console.log("Order outstanding after charge", $scope.order.outstandingBalance)
              $scope.submitOrder();
            })
            .catch( (error) => {
                console.log("Errors with final calc price", error);
            });
            });
          }

          $scope.submitPaymentForm = function(){
            console.log("Submit payment form");
            var requiredFields = {};

            // Get required, non-sensitive, values from host page
            requiredFields["full_name"] = document.getElementById("full_name").value;
            requiredFields["month"] = document.getElementById("month").value;
            requiredFields["year"] = document.getElementById("year").value;

            Spreedly.tokenizeCreditCard(requiredFields);
          }

          //When the value of a radio selector changes
          $scope.radioChanged = function(answer, option){
            $scope.order.answers().target().map( (answerAtI) => {
              if(answerAtI.questionId == answer.questionId){
              answerAtI.assignOption(option);
              $scope.questionValueChanged(answer);
            }
          });
          }

          //When the value of a drop down selector changes
          $scope.selectChanged = function(answer){
            $scope.order.answers().target().map( (answerAtI) => {
              if(answerAtI.questionId == answer.questionId){
              answerAtI.question().options().target().map( (option) => {
                if($scope.optionsHolder[answer.questionId] == option.id){
                answerAtI.assignOption(option);
                $scope.questionValueChanged(answer);
              }
            });
            }
          });
          }

          //When a question value changes
          $scope.questionValueChanged = function(answer){
            if(answer.question().priceCalculating){
              $scope.order.calculatePrice()
              .then( (order) => {
                console.log("Order after calc", $scope.order.attributes());
              $scope.$apply();
            })
            .catch( (error) => {
                console.log("Error with recalc", error);
            });
            }
          }

          //When users submits order form
          $scope.submitOrder = function() {
            console.log("Order Submit", $scope.order);

            $scope.order.save( () => {
              if($scope.order.persisted()){
              console.log("Order save was success");
              alert($scope.product.postTransactionalMessage);
            }else{
              console.log("Order save was not success");
              console.log($scope.order.errors().toArray());
            }
          });
          }

          //Scroll to specified anchor tag
          $scope.scrollToAnchor = function(aid){
            var aTag = $("a[name='"+ aid +"']");
            $('html, body').animate( { scrollTop: aTag.offset().top }, 'slow');
          }

          //Check to see if two dates are on the same day
          $scope.sameDay = function(d1, d2) {
            return d1.getFullYear() === d2.getFullYear() &&
              d1.getMonth() === d2.getMonth() &&
              d1.getDate() === d2.getDate();
          }

          //Return a readble time portion of a date
          $scope.formatToTime = function(dateString){
            let date = new Date(dateString);

            let hours = date.getHours();
            let minutes = date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes().toString;
            let meridian = hours <= 10 ? 'am' : 'pm';
            hours = hours <= 12 ? hours : hours - 12;

            return hours.toString() + ':' + minutes + meridian;
          }

          //Determine which time of day section this timeSlot belongs in
          $scope.splitByTimeOfDay = function(date, time) {
            switch(time){
              case('morning'):
                return new Date(date).getHours() < 12;
                break;
              case('afternoon'):
                return new Date(date).getHours() >= 12 && new Date(date).getHours() < 18;
                break;
              case('evening'):
                return new Date(date).getHours() >= 18;
                break;
            }
          }

          //Return an object collection as an array
          $scope.returnAsArray = function(unmapped) {
            let items = [];
            if($scope.initialDataLoaded){
              unmapped
              .map( (item) => {
                items.push(item);
            });
            }
            return items;
          }

        } //End Controller
      ,
}); //End Component