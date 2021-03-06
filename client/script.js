// A reference to Stripe.js
var stripe;

var orderData = {
  items: [{ id: "photo-subscription" }],
  currency: "mxn" // OXXO only accepts MXN
};

fetch("/create-payment-intent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(orderData)
})
  .then(function(result) {
    return result.json();
  })
  .then(function(data) {
    return setupElements(data);
  })
  .then(function({ stripe, card, clientSecret }) {
    document
      .querySelector("form.card")
      .addEventListener("submit", function(evt) {
        evt.preventDefault();
        // Initiate payment when the submit button is clicked
        payWithCard(stripe, card, clientSecret);
      });
    document
      .querySelector("form.oxxo")
      .addEventListener("submit", function(evt) {
        evt.preventDefault();
        // Initiate payment when the submit button is clicked
        payWithOxxo(stripe, clientSecret);
      });
    document.querySelectorAll(".sr-pm-button").forEach(function(el) {
      el.addEventListener("click", function(evt) {
        // Handle switching between Card and OXXO
        var id = evt.target.id;
        if (id === "card-button") {
          showElement(".sr-payment-form.card");
          hideElement(".sr-payment-form.oxxo");
          document.querySelector("#card-button").classList.add("selected");
          document.querySelector("#oxxo-button").classList.remove("selected");
        } else {
          hideElement(".sr-payment-form.card");
          showElement(".sr-payment-form.oxxo");
          document.querySelector("#card-button").classList.remove("selected");
          document.querySelector("#oxxo-button").classList.add("selected");
        }
      });
    });
  });

// Set up Stripe.js and Elements to use in checkout form
var setupElements = function(data) {
  stripe = Stripe(data.publishableKey, { 
    betas: ["oxxo_pm_beta_1"], 
    apiVersion: `${data.apiVersion};oxxo_beta=${data.oxxoBetaVersion}`
  });
  var elements = stripe.elements({ locale: "es" }); // locale will translate placeholder
  var style = {
    base: {
      color: "#32325d",
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4"
      },
      padding: "10px 12px"
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a"
    }
  };

  var card = elements.create("card", { style: style });
  card.mount("#card-element");

  return {
    stripe: stripe,
    card: card,
    clientSecret: data.clientSecret
  };
};

/* Called when customer pays with a card */
var payWithCard = function(stripe, card, clientSecret) {
  // Initiate the payment.
  // If authentication is required, confirmCardPayment will automatically display a modal
  changeLoadingState(true);

  stripe
    .confirmCardPayment(clientSecret, { payment_method: { card: card } })
    .then(function(result) {
      if (result.error) {
        // Show error to your customer
        showError(result.error.message);
      } else {
        // The payment has been processed!
        orderComplete(clientSecret);
      }
    });
};

/* Called when customer pays with OXXO */
var payWithOxxo = function(stripe, clientSecret) {
  // Initiate the payment.
  // confirmOxxoPayment will create an OXXO voucher and return display details
  changeLoadingState(true);
  stripe
    .confirmOxxoPayment(
      clientSecret,
      {
        payment_method: {
          billing_details: {
            name: document.querySelector('input[name="name"]').value,
            email: document.querySelector('input[name="email"]').value
          }
        }
      },
      { handleActions: false }
    )
    .then(function(result) {
      if (result.error) {
        // Show error to your customer
        showError(result.error.message);
      } else {
        // The OXXO voucher has been created
        // Display the OXXO details to your customer
        displayOxxoDetails(clientSecret);
      }
    });
};

/* ------- Post-payment helpers ------- */

/* Shows a success / error message when the payment is complete */
var orderComplete = function(clientSecret) {
  stripe.retrievePaymentIntent(clientSecret).then(function(result) {
    var paymentIntent = result.paymentIntent;
    var paymentIntentJson = JSON.stringify(paymentIntent, null, 2);

    document.querySelector(".sr-payment-form.oxxo").classList.add("hidden");
    document.querySelector(".sr-payment-form.card").classList.add("hidden");
    document.querySelector("pre").textContent = paymentIntentJson;
    document.querySelector(".sr-picker").classList.add("hidden");
    document.querySelector(".sr-result-card").classList.remove("hidden");
    setTimeout(function() {
      document.querySelector(".sr-result-card").classList.add("expand");
    }, 200);

    changeLoadingState(false);
  });
};

/* Display the OXXO details to your customer when the voucher has been created */
var displayOxxoDetails = function(clientSecret) {
  stripe.retrievePaymentIntent(clientSecret).then(function(result) {
    var paymentIntent = result.paymentIntent;
    const number = paymentIntent.next_action.display_oxxo_details.number;

    var price = (paymentIntent.amount / 100).toFixed(2);
    var numberFormat = new Intl.NumberFormat(["es-MX"], {
      style: "currency",
      currency: paymentIntent.currency,
      currencyDisplay: "symbol"
    });

    document.querySelector(".order-amount").innerText = numberFormat.format(
      price
    );

    document.querySelector(".oxxo-expiry-date").innerText = new Date(
      paymentIntent.next_action.display_oxxo_details.expires_after * 1000
    ).toLocaleDateString("es-MX");

    document.querySelector(".oxxo-display").innerHTML = '<svg id="barcode"></svg>';

    JsBarcode("#barcode", number, {
      // Group the numbers in 4 to make it easier to key i.
      text: number.match(/.{1,4}/g).join("  "),
      width: 2,
      height: 50,
      fontSize: 15
    });

    document.querySelector(".sr-payment-form.oxxo").classList.add("hidden");
    document.querySelector(".sr-picker").classList.add("hidden");
    document.querySelector(".sr-result-oxxo").classList.remove("hidden");
    setTimeout(function() {
      document.querySelector(".sr-result-oxxo").classList.add("expand");
    }, 200);

    changeLoadingState(false);
  });
};

var showError = function(errorMsgText) {
  changeLoadingState(false);

  var errorMsg = document.querySelector(".sr-field-error");
  errorMsg.textContent = errorMsgText;
  setTimeout(function() {
    errorMsg.textContent = "";
  }, 4000);
};

// Show a spinner on payment submission
var changeLoadingState = function(isLoading) {
  const selectedPaymentMethod = document.querySelector(".sr-pm-button.selected")
    .dataset.paymentmethod;

  const className = "." + selectedPaymentMethod;
  if (isLoading) {
    showElement(className + " #spinner");
    hideElement(className + " #button-text");
    document.querySelector(className + " #submit").disabled = true;
  } else {
    hideElement(className + " #spinner");
    showElement(className + " #button-text");
    document.querySelector(className + " #submit").disabled = false;
  }
};

var showElement = function(query) {
  document.querySelector(query).classList.remove("hidden");
};

var hideElement = function(query) {
  document.querySelector(query).classList.add("hidden");
};
