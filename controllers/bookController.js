const async = require('async');
const { body,validationResult } = require('express-validator');

const Book = require('../models/book');
const Author = require('../models/author');
const Genre = require('../models/genre');
const BookInstance = require('../models/bookinstance');


exports.index = function(req, res) {
    async.parallel({
        book_count: (callback) => Book.countDocuments({}, callback),
        book_instance_count: (callback) => BookInstance.countDocuments({}, callback),
        book_instance_available_count: (callback) => BookInstance.countDocuments({status: "Available"}, callback),
        author_count: (callback) => Author.countDocuments({}, callback),
        genre_count: (callback) => Genre.countDocuments({}, callback)
    }, (err, results) => res.render('index', {title: 'Local Library Home', error: err, data: results }));
};

// Display list of all books.
exports.book_list = function(req, res, next) {
    Book.find({}, 'title author')
        .populate('author')
        .exec((err, book_list) => {
            if(err) return next(err);
            res.render('book_list', {title: 'Book List', book_list})
        });
};

// Display detail page for a specific book.
exports.book_detail = function(req, res, next) {
    async.parallel({
        book: (callback) => {
            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback)
            },
        book_instances: (callback) => BookInstance.find({'book': req.params.id}, callback)
    }, (err, {book, book_instances}) => {
        if(err) return next(err);
        if(!book) {
            const err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        res.render('book_detail', {title: book.title, book, book_instances});
    })
};

// Display book create form on GET.
exports.book_create_get = function(req, res, next) {
    // Get all authors and genres, which we can use for adding to our book.
    async.parallel({
        authors: (callback) => {
            Author.find({}, callback);
        },
        genres: (callback) => {
            Genre.find({}, callback);
        },
    }, (err, {authors, genres}) => {
        if(err) return next(err);
        res.render('book_form', { title: 'Create Book', authors, genres});
    });
};

// Handle book create on POST.
exports.book_create_post = [
    // Convert the genre to an array.
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)) {
            if(typeof req.body.genre === 'undefined')
                req.body.genre = [];
            else
                req.body.genre = new Array(req.body.genre);
        }
        next();
    },

    // Validate and sanitise fields.
    body('title', 'Title must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('author', 'Author must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }).escape(),
    body('genre.*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {
        const errors = validationResult(req);

        const book = new Book(
            { title: req.body.title,
              author: req.body.author,
              summary: req.body.summary,
              isbn: req.body.isbn,
              genre: req.body.genre
             }
        );

        if(!errors.isEmpty()) {
            async.parallel({
                authors: (callback) => Author.find({}, callback),
                genres: (callback) => Genre.find({}, callback)
            }, (err, {authors, genres}) => {
                if(err) return next(err);

                // Mark our selected genres as checked.
                for(let i = 0; i < genres.length; i++) {
                    if(book.genre.indexOf(genres[i]._id) > -1) {
                        genres[i].checked = 'true';
                    }
                }
                res.render('book_form', {title: 'Create Book', authors, genres, book, errors: errors.array()});
            })
            return;
        } else {
            book.save((err) => {
                if(err) return next(err);
                res.redirect(book.url);
            })
        }
    }
];

// Display book delete form on GET.
exports.book_delete_get = (req, res) => {
    async.parallel({
        book: (callback) => Book.findById(req.params.id, callback),
        bookinstance_list: (callback) => BookInstance.find({'book': req.params.id}, callback)
    }, (err, {book, bookinstance_list}) => {
        if(err) return next(err);
        if(!book) res.redirect('/catalog/books');

        res.render('book_delete', {title: 'Delete Book', book, bookinstance_list});
    });
};

// Handle book delete on POST.
exports.book_delete_post = function(req, res) {
    async.parallel({
        book: (callback) => Book.findById(req.body.bookid, callback),
        bookinstance_list: (callback) => BookInstance.find({'book': req.body.bookid}, callback)
    }, (err, {book, bookinstance_list}) => {
        if(err) return next(err);
        
        if(bookinstance_list.length > 0) {
            res.render('book_delete', {title: 'Delete Book', book, bookinstance_list});
            return;
        }

        Book.findByIdAndRemove(req.body.bookid, (err) => {
            if(err) return next(err);
            res.redirect('/catalog/books');
        });
    });
};

// Display book update form on GET.
exports.book_update_get = (req, res, next) => {
    async.parallel({
        book: (callback) => Book.findById(req.params.id).populate('author').populate('genre').exec(callback),
        authors: (callback) => Author.find({}, callback),
        genres: (callback) => Genre.find({}, callback)
    }, (err, {book, authors, genres}) => {
        if(err) return next(err);
        
        if(book == null) {
            const err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }

        for(let g of genres) {
            if(book.genre.indexOf(g._id) > -1)
                g.checked='true';
        }

        // for(let all_g_iter = 0; all_g_iter < genres.length; all_g_iter++) {
        //     for(let book_g_iter = 0; book_g_iter < book.genre.length; book_g_iter++) {
        //         if(genres[all_g_iter]._id.toString() === book.genre[book_g_iter]._id.toString()) {
        //             genres[all_g_iter].checked='true';
        //         }
        //     }
        // }
        res.render('book_form', {title: 'Update Book', authors, genres, book});
    });
};

// Handle book update on POST.
exports.book_update_post = [
    // Convert the genre to an array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
            req.body.genre=[];
            else
            req.body.genre=new Array(req.body.genre);
        }
        next();
    },

    // Validate and sanitise fields.
    body('title', 'Title must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('author', 'Author must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }).escape(),
    body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }).escape(),
    body('genre.*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a Book object with escaped/trimmed data and old id.
        const book = new Book({ 
            title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: req.body.genre ? req.body.genre : [],
            _id:req.params.id // This is required, or a new ID will be assigned!
           });

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.
            // Get all authors and genres for form.
            async.parallel({
                authors: (callback) => Author.find(callback),
                genres: (callback) => Genre.find(callback)
            }, (err, {authors, genres}) => {
                if(err) return next(err);

                // Mark our selected genres as checked.
                for(let i = 0; i < genres.length; i++) {
                    if (book.genre.indexOf(genres[i]._id) > -1) {
                        genres[i].checked='true';
                    }
                }
                res.render('book_form', {title: 'Update Book',authors, genres, book, errors: errors.array()});
            });
            return;
        }
        else {
            // Data from form is valid. Update the record.
            Book.findByIdAndUpdate(req.body.id, book, {}, (err,thebook) => {
                if (err) return next(err);
                   // Successful - redirect to book detail page.
                   res.redirect(thebook.url);
            });
        }
    }
];
