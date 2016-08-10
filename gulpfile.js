const gulp = require('gulp');
const mocha = require('gulp-mocha');
const babel = require("gulp-babel");
const istanbul = require('gulp-istanbul');
const help = require('gulp-task-listing');

gulp.task('help', help);
gulp.task('default', ['transpile']);

const TRANSPILE_DEST_DIR = './dist';

gulp.task('transpile', function () {
    return gulp.src("src/*.js")
        .pipe(babel({ "presets": ["es2015"] }))
        .pipe(gulp.dest(TRANSPILE_DEST_DIR));
});

gulp.task('test', ['transpile'], function () {
    return gulp.src('test/index.js', { read: false })
        .pipe(mocha({
            slow: 200,
            reporter: 'spec',
            bail: true,
            timeout: 10000
        }))
        .once('error', function (err) {
            console.error(err.stack);
            process.exit(1);
        })
        .once('end', function () {
            process.exit();
        });
});

gulp.task('istanbul-pre-test', function () {
    return gulp.src(['src/**/*.js'])
        .pipe(istanbul())
        .pipe(istanbul.hookRequire());
});

gulp.task('test-cov', ['istanbul-pre-test'], function () {
    return gulp.src('test/index.js', { read: false })
        .pipe(mocha({
            reporter: 'dot'
        }))
        .pipe(istanbul.writeReports())
        .once('error', function (err) {
            console.error(err.stack);
            process.exit(1);
        })
        .once('end', function () {
            process.exit();
        });
});
