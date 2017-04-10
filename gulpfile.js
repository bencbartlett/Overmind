/*jshint esversion: 6, node: true */
'use strict';

const gutil = require('gulp-util');
const clean = require('gulp-clean');
const gulp = require('gulp');
const gulpDotFlatten = require('./libs/gulp-dot-flatten.js');
const gulpRename = require('gulp-rename');
const gulpScreepsUpload = require('./libs/gulp-screeps-upload.js');
const path = require('path');
const PluginError = require('gulp-util').PluginError;
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');
const tsProject = ts.createProject('tsconfig.json', { typescript: require('typescript') });
const webpack = require('webpack-stream');

/********/
/* INIT */
/********/

let config;

try {
    config = require('./config.json');
} catch (error) {
    if (error.code == "MODULE_NOT_FOUND") {
        gutil.log(gutil.colors.red('ERROR'), 'Could not find file "config.json"');
    } else {
        gutil.log(error);
    }
    process.exit();
}

if (!config.user || !config.user.email || !config.user.password) {
    gutil.log(gutil.colors.red('ERROR'), 'Invalid "config.json" file: cannot find user credentials');
    process.exit();
}

if (!config.targets) {
    gutil.log(gutil.colors.red('ERROR'), 'Invalid "config.json" file: cannot find build targets');
    process.exit();
}

if (!config.defaultTarget || !config.targets[config.defaultTarget]) {
    gutil.log(gutil.colors.red('ERROR'), 'Invalid "config.json" file: cannot find default build target');
    process.exit();
}

gutil.log('Successfully loaded', gutil.colors.magenta('config.json'));

if (gutil.env.target) {
    if (!config.targets[gutil.env.target]) {
        gutil.log(gutil.colors.red('ERROR'), 'Invalid build target "' + gutil.env.target + '"');
        gutil.log('Valid build targets are:', '"' + Object.keys(config.targets).join('", "') + '"');
        process.exit();
    }
    gutil.log('Using selected build target', gutil.colors.magenta(gutil.env.target));
} else {
    gutil.log('Using default build target', gutil.colors.magenta(config.defaultTarget));
}

const buildTarget = gutil.env.target || config.defaultTarget;
const buildConfig = config.targets[buildTarget];

/*********/
/* TASKS */
/*********/

gulp.task('lint', function(done) {
    if (buildConfig.lint) {
        gutil.log('linting ...');
        return gulp.src('src/**/*.ts')
                   .pipe(tslint({ formatter: 'prose' }))
                   .pipe(tslint.report({
                                           summarizeFailureOutput: true,
                                           emitError: buildConfig.lintRequired === true
                                       }));
    } else {
        gutil.log('skipped lint, according to config');
        return done();
    }
});

gulp.task('clean', function () {
    return gulp.src(['dist/tmp/', 'dist/' + buildTarget], { read: false, allowEmpty: true })
               .pipe(clean());
});

gulp.task('compile-bundled', gulp.series(gulp.parallel('lint', 'clean'), function bundle() {
    const webpackConfig = require('./webpack.config.js');
    return gulp.src('src/main.ts')
               .pipe(webpack(webpackConfig))
               .pipe(gulp.dest('dist/' + buildTarget));
}));

gulp.task('compile-flattened', gulp.series(
    gulp.parallel('lint', 'clean'),
    function tsc() {
        global.compileFailed = false;
        return tsProject.src()
                        .pipe(tsProject())
                        .on('error', (err) => global.compileFailed = true)
                        .js.pipe(gulp.dest('dist/tmp'));
    },
    function checkTsc(done) {
        if (!global.compileFailed) {
            return done();
        }
        throw new PluginError("gulp-typescript", "failed to compile: not executing further tasks");
    },
    function flatten() {
        return gulp.src('dist/tmp/**/*.js')
                   .pipe(gulpDotFlatten(0))
                   .pipe(gulp.dest('dist/' + buildTarget));
    }
));

gulp.task('compile', gulp.series(buildConfig.bundle ? 'compile-bundled' : 'compile-flattened'));

gulp.task('upload', gulp.series('compile', function uploading() {
    return gulp.src('dist/' + buildTarget + '/*.js')
               .pipe(gulpRename((path) => path.extname = ''))
               .pipe(gulpScreepsUpload(config.user.email, config.user.password, buildConfig.branch, 0));
}));

gulp.task('copyLocal', gulp.series('compile', function() {
    return gulp.src('dist/dev/*')
               .pipe(gulp.dest(config.localPath));
}));


gulp.task('watchUpload', function () {
    gulp.watch('src/**/*.ts', gulp.series('upload'))
        .on('all', function(event, path, stats) {
            console.log('');
            gutil.log(gutil.colors.green('File ' + path + ' was ' + event + 'ed, running tasks...'));
        })
        .on('error', function () {
            gutil.log(gutil.colors.green('Error during build tasks: aborting'));
        });
});

gulp.task('watchLocal', function () {
    gulp.watch('src/**/*.ts', gulp.series('copyLocal'))
        .on('all', function(event, path, stats) {
            console.log('');
            gutil.log(gutil.colors.green('File ' + path + ' was ' + event + 'ed, running tasks...'));
        })
        .on('error', function () {
            gutil.log(gutil.colors.green('Error during build tasks: aborting'));
        });
});

gulp.task('build', gulp.series('upload', function buildDone(done) {
    gutil.log(gutil.colors.green('Build done'));
    return done();
}));
gulp.task('test', gulp.series('lint'));
gulp.task('default', gulp.series('watchLocal'));