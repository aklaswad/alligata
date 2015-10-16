lines = []
connections = []
io = {}
ioprof = {}
ns = {}
branch = {}
tail = 1
debug = 1
p = (s)-> lines.push s
c = (s)-> connections.push s
d = (s)-> lines.push s if debug
offset = (val) ->
  "Wani.createDCOffset(#{val})"

funcs =
  audioParam: (name, def, min, max)->
    throw "audioParam requires name" unless name?.string?
    throw "audioParam requires default value" unless def?.number?
    pname = name.string
    pdef = def.number
    me = ++tail;
    io[pname] = me
    nMin = if min.minus then min.number * -1 else min.number
    nMax = if max.minus then max.number * -1 else max.number
    ioprof[pname] =
      range: [ nMin, nMax ]
    console.log ">>",ioprof
    p "nodes[#{me}] = module['#{pname}'] = Wani.createAudioParam(ctx,#{pdef});"
    c "nodes[#{me}].connect(nodes[#{this.dest}]);" if this.dest
    return me

prefix = ()-> """
(function (ctx, module) {
  var nodes = [];

"""

suffix = ()-> """


// Done, then returns collected I/O.
  return #{JSON.stringify(ioprof)};
})(ctx,module);
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
  expression = expression.replace /\#[^\n]*\n/g, '\n'
  expression = expression.replace /\#.*$/, ''

  try
    tree = Alligata.parser.parse(expression)
  catch e
    throw "Parse error: #{e}"
  # $('#tree').val( JSON.stringify tree )
  # p "nodes[0] = io['output'] = ctx.createGain()"
  try
    _generate tree, {}
  catch e
    throw "Compile error: #{e}"
  prefix() + "  " + lines.join("\n  ") + "\n\n  " + connections.join("\n  ") + suffix()

_resolve_prop = () -> 1

_generate = (tree, ctx) ->
  if tree.func
    name = tree.func
    throw "Undefined function [#{name}]" unless funcs[name]
    return funcs[name].apply(ctx,tree.args.args)
  else if tree.js?
    p tree.js
  else if tree.s
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
  else if tree.sigil == ':'
    name = tree.prop.join '.'
    if io[name]
      c "nodes[#{io[name]}].connect(nodes[#{ctx.dest}]);" if ctx.dest
      return io[name]
    me = ++tail
    p "nodes[#{me}] = module['#{name}'] = Wani.createAudioParam(ctx);"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);" if ctx.dest
    io[name] = me
    return me
  else if tree.sigil == '$'
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
    p "nodes[#{me}] = #{name};"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);" if ctx.dest
    io[name] = me
    return me
  else if tree.number
    me = ++tail
    p "nodes[#{me}] = #{offset(tree.number)};"
    c "nodes[#{me}].connect(nodes[#{ctx.dest}]);"
    return me
  else if tree.additive
    _generate tree.additive, {dest: ctx.dest, subdest: ctx.subdest}
    return
  else if tree.op == '+'
    unless ctx.dest
      ctx.dest = me = ++tail
      p "nodes[#{me}] = io['__output'] = ctx.createGain();"
    if ctx.sub
      _generate tree.l, {add:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {add:1, dest:ctx.subdest, subdest:ctx.dest}
    else
      _generate tree.l, {add:1, dest:ctx.dest, subdest:ctx.subdest}
      _generate tree.r, {add:1, dest:ctx.dest, subdest:ctx.subdest}
    return
  else if tree.op == '-'
    unless ctx.dest
      ctx.dest = me = ++tail
      p "nodes[#{me}] = io['__output'] = ctx.createGain();"
    unless ctx.subdest?
      ctx.subdest = ++tail
      p "nodes[#{ctx.subdest}] = ctx.createGain();"
      p "nodes[#{ctx.subdest}].gain.value = -1.0;"
      c "nodes[#{ctx.subdest}].connect(nodes[#{ctx.dest}]);"
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
    p "nodes[#{me}] = ctx.createGain();"
    p "nodes[#{multiplier}] = nodes[#{me}].gain;"
    p "nodes[#{multiplier}].value = 0.0;"
    _generate tree.l, {dest: me}
    _generate tree.r, {dest: multiplier}
    if ctx.dest
      c "nodes[#{me}].connect(nodes[#{ctx.dest}]);"
    return me
  else if tree.op == '/'
    throw "division is not supported :P"
  else if tree.void
    return
  else
    throw "unknown operator"

module.exports = compile if module?
window.Alligata.compile = compile if window?.Alligata?
