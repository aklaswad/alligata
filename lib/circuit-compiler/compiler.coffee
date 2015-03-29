lines = []
connections = []
io = {}
ns = {}
branch = {}
tail = 1
debug = 1
p = (s)-> lines.push s
c = (s)-> connections.push s
d = (s)-> lines.push s if debug
offset = (val) ->
  "Wani.createDCOffset(ctx,#{val})"

funcs =
  audioParam: (name, def)->
    console.log 'ap',this, arguments
    throw "audioParam requires name" unless name?.string?
    throw "audioParam requires default value" unless def?.number?
    name = name.string
    def = def.number
    me = ++tail;
    io[name] = me
    p "nodes[#{me}] = io['#{name}'] = Wani.createAudioParam(ctx,#{def});"
    c "nodes[#{me}].connect(nodes[#{this.dest}]);" if this.dest
    return me

prefix = """
var io = (function (ctx) {
  var io = {};
  var nodes = [];

"""

suffix = """


  // done
  return io;
})(ctx);
"""
compile = (expression) ->
  tail = 0
  io = {}
  lines = []
  connections = []
  ns = {}
  branch = {}
  expression = expression.replace /^\s+/,''
  expression = expression.replace /\s+$/,''
  try
    tree = Alligata.parser.parse(expression)
  catch e
    throw "Parse error: #{e}"
  console.log tree
  # $('#tree').val( JSON.stringify tree )
  # p "nodes[0] = io['output'] = ctx.createGain()"
  try
    _generate tree, {}
  catch e
    throw "Compile error: #{e}"
  prefix + "  " + lines.join("\n  ") + "\n\n  " + connections.join("\n  ") + suffix

_resolve_prop = () -> 1

_generate = (tree, ctx) ->
  if tree.func
    name = tree.func
    throw "Undefined function [#{name}]" unless funcs[name]
    return funcs[name].apply(ctx,tree.args.args)
  if tree.s
    _generate tree.s, {}
    _generate tree.ss, {}
    return
  else if tree.lval
    lval = _generate tree.lval, {lval:1}
    throw "invalid lvalue #{lval}" unless lval?
    if lval.type == 'branch'
      branch[lval.name] = tree.rval
      return
    _generate tree.rval, {dest: lval}
    return
  else if tree.sigil == '$'
    name = tree.prop.join('.')
    if io[name]
      c "nodes['#{io[name]}'].connect(nodes[#{ctx.dest}]);" if ctx.dest
      return io[name]
    me = ++tail
    p "nodes[#{me}] = io['#{name}'] = ctx.createGain(); // make io"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);" if ctx.dest
    io[name] = me
    return me
  else if tree.sigil == ':'
    name = tree.prop.join '.'
    if io[name]
      c "nodes[#{io[name]}].connect(nodes[#{ctx.dest}]);" if ctx.dest
      return io[name]
    me = ++tail
    p "nodes[#{me}] = io['#{name}'] = Wani.createAudioParam(ctx); // make io"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);" if ctx.dest
    io[name] = me
    return me
  else if tree.sigil == '#'
    name = tree.prop.join '.'
    if ctx.lval
      branch[name];
      return {type: 'branch', name: name}
    else
      brc = branch[name]
      throw "unregistered branch #{name} was invoked" unless brc?
      return _generate brc,ctx
  else if tree.prop
    name = tree.prop.join '.'
    if ns[name]
      c "nodes[#{io[name]}].connect(nodes[#{ctx.dest}]);" if ctx.dest
      return ns[name]
    me = ++tail
    ns[name] = me
    p "nodes[#{me}] = #{name}; // Existing node"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);" if ctx.dest
    io[name] = me
    return me
  else if tree.number
    me = ++tail
    p "nodes[#{me}] = #{offset(tree.number)}; // number"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);"
    return me
  else if tree.additive
    _generate tree.additive, {dest: ctx.dest, subdest: ctx.subdest}
    return
  else if tree.op == '+'
    if ctx.sub
      _generate tree.l, {add:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {add:1, dest:ctx.subdest, subdest:ctx.dest}
    else
      _generate tree.l, {add:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {add:1, dest:ctx.dest, subdest:ctx.subdest}
    return
  else if tree.op == '-'
    unless ctx.subdest?
      ctx.subdest = ++tail
      p "nodes[#{ctx.subdest}] = ctx.createGain();"
      p "nodes[#{ctx.subdest}].gain.value = -1"
      c "nodes[#{ctx.subdest}].connect(nodes[#{ctx.dest}]); // negativer for minus()"
    if ctx.sub
      _generate tree.l, {sub:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {sub:1, dest:ctx.dest, subdest:ctx.subdest}
    else
      _generate tree.l, {add:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {sub:1, dest:ctx.subdest, subdest:ctx.dest}
    return
  else if tree.op == '*'
    me = ++tail
    multiplier = ++tail
    p "nodes[#{me}] = ctx.createGain();  // multi(#{me})"
    p "nodes[#{multiplier}] = nodes[#{me}].gain;"
    p "nodes[#{multiplier}].value = 0.0;"
    _generate tree.l, {dest: me}
    _generate tree.r, {dest: multiplier}
    if ctx.dest
      c "nodes[#{me}].connect(nodes[#{ctx.dest}]); // to output from multi(#{me})"
    return me
  else if tree.op == '/'
    throw "division is not supported :P"
  else
    throw "unknown operator"

module.exports = compile if module?
window.Alligata.compile = compile if window?.Alligata?