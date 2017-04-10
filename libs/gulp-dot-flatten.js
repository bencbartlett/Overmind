/*jshint esversion: 6, node: true */


const path = require('path');
const gutil = require('gulp-util');
const through2 = require('through2');
const PluginError = require('gulp-util').PluginError;
const recast = require('recast');

module.exports = function (logAmount, stringFilter) {
  return through2.obj(function (file, enc, next) {
    if (logAmount && logAmount > 2) {
      gutil.log(`>>> flattener starting file '${gutil.colors.cyan(path.dirname(file.relative) + path.sep + path.basename(file.path))}'`);
    }

    if (!file.isDirectory() && !file.isNull() && !file.isStream()) {
      try {
        file.contents = new Buffer(recast.print(recast.visit(recast.parse(file.contents.toString()), {
          visitCallExpression: function (filePath) {
            var expr = filePath.node;

            if (expr.callee.name != 'require') {
              this.traverse(filePath);
            } else if (expr.callee.name == 'require') {
              this.traverse(filePath);
              if (expr.arguments.length) {
                let arg = expr.arguments[0]
                if (arg.type == 'Literal' && arg.value[0] == '.') {
                  let value = path.posix.normalize(path.dirname(file.relative).split(path.sep).join(path.posix.sep) + '/./' + arg.value);
                  let result = './' + value.split('/').join('.');

                  if (stringFilter) result = stringFilter(result);

                  if (logAmount && logAmount > 1) {
                    gutil.log(`> in file '${gutil.colors.cyan(path.dirname(file.relative) + path.sep + path.basename(file.path))}', flattened path '${gutil.colors.cyan(expr.arguments[0].value)}' into '${gutil.colors.cyan(result)}'`);
                  }
                  result = result.replace(/[.](ts|js)/g, '')
                  expr.arguments[0] = arg.raw.charAt(0) + result + arg.raw.charAt(0);
                } else {
                  gutil.log(`> Non Literal argument for 'require' in '${gutil.colors.cyan(path.dirname(file.relative) + path.sep + path.basename(file.path))}' location: ${arg.loc.start.line}:${arg.loc.start.column}`)
                }
              } else {
                if (logAmount && logAmount > 2) {
                  gutil.log('> failed test: expr.arguments.length && expr.arguments[0].value[0] == \'.\' : ' + expr.arguments[0].value);
                }
              }
            } else {
              return false;
            }
          },
        })).code);

        let relPath = path.dirname(file.relative).split(path.sep);
        relPath.push(path.basename(file.path));

        let newName = relPath.join('.');

        while (newName[0] == '.') newName = newName.slice(1);
        if (stringFilter) newName = stringFilter(newName);

        if (logAmount && logAmount > 0) {
          gutil.log(`>> flattened file '${gutil.colors.cyan(path.dirname(file.relative) + path.sep + path.basename(file.path))}' into '${gutil.colors.cyan(newName)}'`);
        }

        file.path = path.join(file.base, '', newName);
        this.push(file);
      } catch (e) {
        this.emit('error', new PluginError('flatten', e));
      }
    }

    next();
  });
};
