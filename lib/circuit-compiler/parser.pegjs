{
  var exps = [];
}

start
  = statements

s
  = [ \n\t]*

statements
  = statement:statement statements:statements { return {s: statement, ss: statements}; }
  / statement

statement
  = expression:expression s ';'? s { return expression }
  / jscomment
  / voidline

voidline
 = [\s]* "\n" { return { void: 1 }}

jscomment
  = '!' js:[^\n]* "\n" { return {js:js.join('')}}

expression
  = substitution
  / additive

substitution
  = lval:lval s '=' s rval:rval { return {lval: lval, rval: rval}; }

lval
  = prop
  / variable

rval
  = expression


additive
  = left:multiplicative s op:[+-] s right:additive { return {l:left,r:right,op:op}; }
  / multiplicative

multiplicative
  = left:primary s op:[*/%] s right:multiplicative { return {l:left,r:right,op:op}; }
  / primary

primary
  = number
  / function
  / variable
  / prop
  / string
  / "(" s additive:additive s ")" { return {additive: additive }; }

string
  = '"' string:[^"]* '"' { return {string: string.join('') } }
  / "'" string:[^']* "'" { return {string: string.join('') } }

prop "prop"
  = word:word '.' prop:prop { prop.prop.unshift(word); return prop; }
  / word:word { return {prop: [word]}; }

function
  = name:word '(' s args:arguments s ')' {return {func: name, args:args}}
  / name:word '(' s ')' { return {func: name, args:{args:[]}}; }

arguments
  = arg:expression s ',' s args:arguments { args.args.unshift(arg); return args; }
  / exp:expression { return {args:[exp]}; }

variable "variable"
  = sigil:[:$]? prop:prop { return {sigil:sigil, prop: prop.prop}; }

word "word"
  = head:[a-zA-Z] tail:[0-9A-Za-z]* { return head + tail.join(''); }

number "number"
  = minus:'-'? digits:[0-9]+ float:float? { return { number: digits.join("") + '.' + (float || '0'), minus: minus }; }

float
  = '.' digits:[0-9]+ { return digits.join(''); }

