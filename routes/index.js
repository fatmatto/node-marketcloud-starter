var express = require('express');
var router = express.Router();
var qs = require('querystring');
var Marketcloud = require('marketcloud-node');



/* GET home page. */

router.get('/', function(req, res, next) {

  var mc = req.app.get('marketcloud')


  Marketcloud.Promise.all([
    mc.products.list({
      published: true
    }),
    mc.categories.list({}),
    mc.brands.list({})
  ]).then(function(results) {

    res.render('index', {
      products: results[0].data,
      categories: results[1].data,
      brands: results[2].data
    });
  }).catch(function(response) {
    console.log("Error", response);
    res.render('error', {
      message: response.message,
      error: response,
      title: 'error'
    });
  })

});


router.get('/item/:product_id', function(req, res, next) {
  var mc = req.app.get('marketcloud')
  return mc.products.getById(req.params.product_id)
    .then(function(response) {
      res.render('item', {
        product: response.data
      });
    })
    .catch(function(response) {
      console.log("Error", response);
      res.render('error', {
        message: response.message,
        error: response,
        title: 'error'
      });
    })
})


router.get('/checkout', function(req, res, next) {
  var mc = req.app.get('marketcloud');
  var cart = res.locals.cart;

  //Short-circuiting to cart view
  if (cart.items.length === 0)
    return res.render('cart');

  var total_value = cart.items
    .map(function(x) {
      return x.price * x.quantity;
    })
    .reduce(function(a, b) {
      return a + b;
    });

  return Marketcloud.Promise.all([
      mc.shippings.list({
        value: total_value
      }),
      mc.paymentMethods.list({})
    ])
    .then(function(response) {
      res.render('checkout', {
        shippings: response[0].data,
        paymentMethods: response[1].data,
        error: req.query.error
      })
    })
    .catch(function(response) {
      console.log("Error", response);
      res.render('error', {
        message: response.message,
        error: response,
        title: 'error'
      });
    })

})

router.get('/checkout/:cartId', function(req, res, next) {
  var mc = req.app.get('marketcloud');
  var cart_id = Number(req.params.cartId);
  res.locals.checkout_cart_id = cart_id;
  mc.carts.getById(cart_id)
    .then(function(response) {
      req.session.cart_id = cart_id;
      res.locals.cart = response.data;
      var cart = res.locals.cart;

      //Short-circuiting to cart view
      if (cart.items.length === 0)
        return res.render('cart');

      // FIXME this does not take discounts in account
      var total_value = cart.items
        .map(function(x) {
          return x.price * x.quantity;
        })
        .reduce(function(a, b) {
          return a + b;
        });

      return Marketcloud.Promise.all([
          mc.shippings.list({
            value: total_value
          }),
          mc.paymentMethods.list({})
        ])
        .then(function(response) {
          res.render('served_checkout', {
            shippings: response[0].data,
            paymentMethods: response[1].data,
            error: req.query.error
          })
        })
        .catch(function(response) {
          console.log("Error", response);
          res.render('error', {
            message: response.message,
            error: response,
            title: 'error'
          });
        })
    })
    .catch(function(err) {
      return res.render('404');
    })


})

router.post('/checkout/:cartId', function(req, res, next) {

  var mc = req.app.get('marketcloud');
  var order = JSON.parse(req.body.order);

  var cart_id = Number(req.params.cartId)

  return mc.orders.create(order)
    .then(function(response) {

      created_order = response.data;
      //Creating the payment now


      // First of all, let's check which payment method was selected by the customer
      if (created_order.hasOwnProperty('payment_method')) {
        // Then its a custom payment method
        //TODO need refactor into promise composition
        return new Promise((resolve, reject) => {
          return resolve({});
        });
      }
      // Otherwise we are using a built in method
      // TODO must unify this.
      var payment = {
        method: 'Braintree',
        order_id: created_order.id,
        nonce: 'fake-valid-nonce'
      };

      return mc.payments.create(payment);
    })
    .then(function(response) {
      //The payment was ok or not required
      res.render('order_confirmed', {
        order: created_order
      })
    })
    .catch(function(response) {
      res.redirect('/checkout/'+cart_id+'?error=' + qs.escape(response.message));
    })
})

router.post('/checkout', function(req, res, next) {

  var mc = req.app.get('marketcloud');
  var order = JSON.parse(req.body.order);

  return mc.orders.create(order)
    .then(function(response) {

      created_order = response.data;
      //Creating the payment now


      // First of all, let's check which payment method was selected by the customer
      if (created_order.hasOwnProperty('payment_method')) {
        // Then its a custom payment method
        //TODO need refactor into promise composition
        return new Promise((resolve, reject) => {
          return resolve({});
        });
      }
      // Otherwise we are using a built in method
      // TODO must unify this.
      var payment = {
        method: 'Braintree',
        order_id: created_order.id,
        nonce: 'fake-valid-nonce'
      };

      return mc.payments.create(payment);
    })
    .then(function(response) {
      //The payment was ok or not required
      res.render('order_confirmed', {
        order: created_order
      })
    })
    .catch(function(response) {
      res.redirect('/checkout?error=' + qs.escape(response.message));
    })
})

router.get('/cart', function(req, res, next) {
  var mc = req.app.get('marketcloud')
  res.render('cart')
})


router.get('/search', function(req, res, next) {
  var qry = req.query;
  qry.published = true;
  var mc = req.app.get('marketcloud')
  return Marketcloud.Promise.all([
    mc.products.list(qry),
    mc.categories.list({}),
    mc.brands.list({})
  ]).then(function(results) {

    res.render('index', {
      products: results[0].data,
      categories: results[1].data,
      brands: results[2].data
    });
  }).catch(function(response) {
    console.log("Error", response);
    res.render('error', {
      message: response.message,
      error: response,
      title: 'error'
    });
  })

})


router.get('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    if (err)
      return next(err);
    else
      res.redirect('/');
  })
})
router.get('/login', function(req, res, next) {
  res.render('login');
})

router.post('/login', function(req, res, next) {
  // If error, render the loging screen with an error message


  var mc = req.app.get('marketcloud');

  return mc.users.authenticate(req.body.email, req.body.password)
    .then(function(response) {

      req.session.user = response.data.user;
      req.session.user.token = response.data.token;

      res.redirect('/')
    })
    .catch(function(response) {
      res.render('login', {
        error: 'Invalid credentials'
      });
    })
})



router.get('/signup', function(req, res, next) {
  res.render('signup');
})

router.post('/signup', function(req, res, next) {
  // If error, render the loging screen with an error message
  var mc = req.app.get('marketcloud');
  var user = req.body;
  //You can add custom data to user
  return mc.users.create(user)
    .then(function(response) {
      res.render('login', {
        message: 'Your account was successfully created.'
      })
    })
    .catch(function(response) {
      console.log("Error", response);
      var error_message = response.message || 'An error has occurred';
      res.render('signup', {
        error: error_message
      })
    })
})

module.exports = router;