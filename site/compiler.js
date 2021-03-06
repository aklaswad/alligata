// Generated by CoffeeScript 1.9.1
(function() {
  var _generate, _resolve_prop, branch, c, compile, connections, d, debug, funcs, io, ioprof, lines, ns, offset, p, prefix, suffix, tail;

  lines = [];

  connections = [];

  io = {};

  ioprof = {};

  ns = {};

  branch = {};

  tail = 1;

  debug = 1;

  p = function(s) {
    return lines.push(s);
  };

  c = function(s) {
    return connections.push(s);
  };

  d = function(s) {
    if (debug) {
      return lines.push(s);
    }
  };

  offset = function(val) {
    return "Wani.createDCOffset(" + val + ")";
  };

  funcs = {
    audioParam: function(name, def, min, max) {
      var me, nMax, nMin, pdef, pname;
      if ((name != null ? name.string : void 0) == null) {
        throw "audioParam requires name";
      }
      if ((def != null ? def.number : void 0) == null) {
        throw "audioParam requires default value";
      }
      pname = name.string;
      pdef = def.number;
      me = ++tail;
      io[pname] = me;
      nMin = min.minus ? min.number * -1 : min.number;
      nMax = max.minus ? max.number * -1 : max.number;
      ioprof[pname] = {
        range: [nMin, nMax]
      };
      console.log(">>", ioprof);
      p("nodes[" + me + "] = module['" + pname + "'] = Wani.createAudioParam(ctx," + pdef + ");");
      if (this.dest) {
        c("nodes[" + me + "].connect(nodes[" + this.dest + "]);");
      }
      return me;
    }
  };

  prefix = function() {
    return "(function (ctx, module) {\n  var nodes = [];\n";
  };

  suffix = function() {
    return "\n\n// Done, then returns collected I/O.\n  return " + (JSON.stringify(ioprof)) + ";\n})(ctx,module);";
  };

  compile = function(expression) {
    var e, tree;
    tail = 0;
    io = {};
    lines = [];
    connections = [];
    ns = {};
    branch = {};
    ioprof = {};
    expression = expression.replace(/^\s+/, '');
    expression = expression.replace(/\s+$/, '');
    expression = expression.replace(/\#[^\n]*\n/g, '\n');
    expression = expression.replace(/\#.*$/, '');
    try {
      tree = Alligata.parser.parse(expression);
    } catch (_error) {
      e = _error;
      throw "Parse error: " + e;
    }
    try {
      _generate(tree, {});
    } catch (_error) {
      e = _error;
      throw "Compile error: " + e;
    }
    return prefix() + "  " + lines.join("\n  ") + "\n\n  " + connections.join("\n  ") + suffix();
  };

  _resolve_prop = function() {
    return 1;
  };

  _generate = function(tree, ctx) {
    var brc, lval, me, multiplier, name;
    if (tree.func) {
      name = tree.func;
      if (!funcs[name]) {
        throw "Undefined function [" + name + "]";
      }
      return funcs[name].apply(ctx, tree.args.args);
    } else if (tree.js != null) {
      return p(tree.js);
    } else if (tree.s) {
      _generate(tree.s, {});
      _generate(tree.ss, {});
    } else if (tree.lval) {
      lval = _generate(tree.lval, {
        lval: 1
      });
      if (lval == null) {
        throw "invalid lvalue " + lval;
      }
      if (lval.type === 'branch') {
        branch[lval.name] = tree.rval;
        return;
      }
      _generate(tree.rval, {
        dest: lval
      });
    } else if (tree.sigil === ':') {
      name = tree.prop.join('.');
      if (io[name]) {
        if (ctx.dest) {
          c("nodes[" + io[name] + "].connect(nodes[" + ctx.dest + "]);");
        }
        return io[name];
      }
      me = ++tail;
      p("nodes[" + me + "] = module['" + name + "'] = Wani.createAudioParam(ctx);");
      if (ctx.dest) {
        c("nodes[" + me + "].connect(nodes[" + ctx.dest + "]);");
      }
      io[name] = me;
      return me;
    } else if (tree.sigil === '$') {
      name = tree.prop.join('.');
      if (ctx.lval) {
        branch[name];
        return {
          type: 'branch',
          name: name
        };
      } else {
        brc = branch[name];
        if (brc == null) {
          throw "unregistered branch " + name + " was invoked";
        }
        return _generate(brc, ctx);
      }
    } else if (tree.prop) {
      name = tree.prop.join('.');
      if (ns[name]) {
        if (ctx.dest) {
          c("nodes[" + io[name] + "].connect(nodes[" + ctx.dest + "]);");
        }
        return ns[name];
      }
      me = ++tail;
      ns[name] = me;
      p("nodes[" + me + "] = " + name + ";");
      if (ctx.dest) {
        c("nodes[" + me + "].connect(nodes[" + ctx.dest + "]);");
      }
      io[name] = me;
      return me;
    } else if (tree.number) {
      me = ++tail;
      p("nodes[" + me + "] = " + (offset(tree.number)) + ";");
      c("nodes[" + me + "].connect(nodes[" + ctx.dest + "]);");
      return me;
    } else if (tree.additive) {
      _generate(tree.additive, {
        dest: ctx.dest,
        subdest: ctx.subdest
      });
    } else if (tree.op === '+') {
      if (!ctx.dest) {
        ctx.dest = me = ++tail;
        p("nodes[" + me + "] = io['__output'] = ctx.createGain();");
      }
      if (ctx.sub) {
        _generate(tree.l, {
          add: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
        _generate(tree.r, {
          add: 1,
          dest: ctx.subdest,
          subdest: ctx.dest
        });
      } else {
        _generate(tree.l, {
          add: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
        _generate(tree.r, {
          add: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
      }
    } else if (tree.op === '-') {
      if (!ctx.dest) {
        ctx.dest = me = ++tail;
        p("nodes[" + me + "] = io['__output'] = ctx.createGain();");
      }
      if (ctx.subdest == null) {
        ctx.subdest = ++tail;
        p("nodes[" + ctx.subdest + "] = ctx.createGain();");
        p("nodes[" + ctx.subdest + "].gain.value = -1.0;");
        c("nodes[" + ctx.subdest + "].connect(nodes[" + ctx.dest + "]);");
      }
      if (ctx.sub) {
        _generate(tree.l, {
          sub: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
        _generate(tree.r, {
          sub: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
      } else {
        _generate(tree.l, {
          add: 1,
          dest: ctx.dest,
          subdest: ctx.subdest
        });
        _generate(tree.r, {
          sub: 1,
          dest: ctx.subdest,
          subdest: ctx.dest
        });
      }
    } else if (tree.op === '*') {
      me = ++tail;
      multiplier = ++tail;
      p("nodes[" + me + "] = ctx.createGain();");
      p("nodes[" + multiplier + "] = nodes[" + me + "].gain;");
      p("nodes[" + multiplier + "].value = 0.0;");
      _generate(tree.l, {
        dest: me
      });
      _generate(tree.r, {
        dest: multiplier
      });
      if (ctx.dest) {
        c("nodes[" + me + "].connect(nodes[" + ctx.dest + "]);");
      }
      return me;
    } else if (tree.op === '/') {
      throw "division is not supported :P";
    } else if (tree["void"]) {

    } else {
      throw "unknown operator";
    }
  };

  if (typeof module !== "undefined" && module !== null) {
    module.exports = compile;
  }

  if ((typeof window !== "undefined" && window !== null ? window.Alligata : void 0) != null) {
    window.Alligata.compile = compile;
  }

}).call(this);
