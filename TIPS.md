# Web Audio Tips

## Making DC offset

```
var shaper, osc, mute; // Keep this global to share each offsets
function generateOffsetSource (ctx) {
  shaper = ctx.createWaveShaper();
  shaper.curve = Float32Array([1,1]);
  osc = ctx.createOscillator();
  mute = ctx.createGain();  // dummy output to make sure osc provides signals
  mute.gain.value = 0.0;
  osc.connect(shaper);
  shaper.connect(mute);
  mute.connect(ctx.destination);
}

function getOffsetNode (ctx, value) {
  if (!shaper) generateOffsetSource(ctx);
  var gain = ctx.createGain();
  gain.gain.value = value;
  shaper.connect(gain);
  gain._dispatch = function () {
    shaper.disconnect(gain);
  };
  return gain;
}
```

## Arithmetics for audio signals

### +

just connect to same AudioNode

```
var plus = ctx.createGain();
var left = ctx.createGain();
var right = ctx.createGain();
left.connect(plus);
right.connect(plus);
```

### *

connect one to GainNode and other to GainNode.gain

```
var multiplicand = ctx.createOscillator();
var multiplier = ctx.createOscillator();
var product = ctx.createGain();
product.gain.value = 0.0;
multiplicand.connect(product);
multiplier.connect(product.gain);
```

### -

multiply the minuend with offset which provides -1, then add them.

```
var subtrahend = ctx.createOscillator();
var minuend = ctx.createOscillator();
var difference = ctx.createGain();
var product = ctx.createGain();
product.gain.value = 0.0;
var offset = getOffsetNode(-1);
subtrahend.connect(difference);
minuend.connect(product);
offset.connect(product.gain);
product.connect(difference);

/*
  +------------+  +------------+  +------------+
  | subtrahend |  |   minuend  |  | offset(-1) |
  +------------+  +------------+  +------------+
        |                |              |
        |         +------------+  gain  |
        |         |  product   |--------+
        |         +------------+
        |                |
  +----------------------------+
  |        difference          |
  +----------------------------+
*/

```

### /

Hmm.. It's hard to implement division circuit with current WebAudio API set.....

One is, just use ScriptProcessorNode. but it might be so slow :P

Another idea is, use WaveShaper node which prepared as the result of divisions for any numbers. This way is fast, but don't returns collect value.
Note that, WaveShaper Node only accepts the signal range from -1 to +1, so If you handling non-audio signals (which amplified to out of -1 ~ +1, e.g. LFO signal for frequecny), you need to normalize it.

BTW, if you just want to divide by some known constant, just multiply with it's reciprocal ;)

