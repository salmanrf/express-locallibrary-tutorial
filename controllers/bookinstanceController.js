const async = require('async');
const { body,validationResult } = require('express-validator');

const BookInstance = require('../models/bookinstance');
const Book = require('../models/book');

// Display list of all BookInstances.
exports.bookinstance_list = function(req, res, next) {
    BookInstance.find({})
        .populate('book')
        .exec((err, bookinstance_list) => {
            if(err) return next(err);
            res.render('bookinstance_list', {title: 'Book Instance List', bookinstance_list});
        });
};

// Display detail page for a specific BookInstance.
exports.bookinstance_detail = function(req, res, next) {
    BookInstance.findById(req.params.id)
        .populate('book')
        .exec((err, bookinstance) => {
            if(err) return next(err);
            if(bookinstance==null) { 
                const err = new Error('Book copy not found');
                err.status = 404;
                return next(err);
            }
            res.render('bookinstance_detail', {title: `Copy: ${bookinstance.book.title}`, bookinstance});
        });
};

// Display BookInstance create form on GET.
exports.bookinstance_create_get = function(req, res, next) {
    Book.find({},'title')
    .exec((err, books) => {
      if (err) return next(err);
      // Successful, so render.
      res.render('bookinstance_form', {title: 'Create BookInstance', book_list: books});
    });
};

// Handle BookInstance create on POST.
exports.bookinstance_create_post = [

    // Validate and sanitise fields.
    body('book', 'Book must be specified').trim().isLength({ min: 1 }).escape(),
    body('imprint', 'Imprint must be specified').trim().isLength({ min: 1 }).escape(),
    body('status').escape(),
    body('due_back', 'Invalid date').optional({ checkFalsy: true }).isISO8601().toDate(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a BookInstance object with escaped and trimmed data.
        const bookinstance = new BookInstance(
          { book: req.body.book,
            imprint: req.body.imprint,
            status: req.body.status,
            due_back: req.body.due_back
           });

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values and error messages.
            Book.find({},'title')
                .exec((err, books) => {
                    if (err) return next(err);
                    // Successful, so render.
                    res.render('bookinstance_form', { title: 'Create BookInstance', book_list: books, selected_book: bookinstance.book._id , errors: errors.array(), bookinstance: bookinstance });
                });
            return;
        }
        else {
            // Data from form is valid.
            bookinstance.save((err) => {
                if (err) return next(err);
                   // Successful - redirect to new record.
                   res.redirect(bookinstance.url);
            });
        }
    }
];

// Display BookInstance delete form on GET.
exports.bookinstance_delete_get = function(req, res, next) {
    BookInstance.findById(req.params.id)
        .populate('book')
        .exec((err, bookinstance) => {
            if(err) return next(err);
            res.render('bookinstance_delete', {title: 'Delete BookInstance', bookinstance});
        });
};

// Handle BookInstance delete on POST.
exports.bookinstance_delete_post = function(req, res, next) {
    BookInstance.findByIdAndRemove(req.body.bookinstanceid, (err) => {
        if(err) return next(err);
        // Success - go to author list
        res.redirect('/catalog/bookinstances');
    });
};

// Display BookInstance update form on GET.
exports.bookinstance_update_get = (req, res, next) => {
    async.parallel({
        books: (callback) => Book.find({}, callback),
        bookinstance: (callback) => BookInstance.findById(req.params.id, callback)
    }, (err, {books, bookinstance}) => {
        if(err) return next(err);

        if(!bookinstance) {
            const err = new Error('BookInstance not found');
            err.status = 404;
            return next(err);
        }

        res.render('bookinstance_form', {title: 'Update BookInstance', books, bookinstance});
        return;
    });
};

// Handle bookinstance update on POST.
exports.bookinstance_update_post = [
    body('book', 'Book must be specified').trim().isLength({ min: 1 }).escape(),
    body('imprint', 'Imprint must be specified').trim().isLength({ min: 1 }).escape(),
    body('status').escape(),
    body('due_back', 'Invalid date').optional({ checkFalsy: true }).isISO8601().toDate(),

    (req, res, next) => {
        const errors = validationResult(req);

        if(!errors.isEmpty()) {
            res.render('bookinstance_form', { title: 'Update BookInstance', bookinstance: req.body, errors: errors.array()});
            return;
        }

        const bookinstance = new BookInstance({ 
            _id: req.body.id,
            book: req.body.book,
            imprint: req.body.imprint,
            status: req.body.status,
            due_back: req.body.due_back
        });

        BookInstance.findByIdAndUpdate(req.body.id, bookinstance, {}, (err, bookinstance) => {
            if(err) return next(err);
            res.redirect(bookinstance.url);
        });
    }
];
