(function () {

  var EnvelopeDrawer = function (canvas2dContext, audioContext) {
    this.canvas2dContext = canvas2dContext;
    this.audioContext = audioContext;
    this.zoomX = 128;
    this.zoomY = 64;
    this.offsetX = 0;
    this.offsetY = 0;
    this.height = this.canvas2dContext.canvas.height;
    this.width = this.canvas2dContext.canvas.width;
    this._processorSize = 8192 / 8;
    this.init();
  };

  EnvelopeDrawer.prototype.init = function () {
    var actx = this.audioContext;
    var osc = actx.createOscillator();
    var flattener = actx.createWaveShaper();
    var drawer = this.drawer = actx.createScriptProcessor(this._processorSize);
    var mute = this.mute = actx.createGain();
    var tester = this.tester = actx.createGain();

    this.path = [];

    flattener.curve = new Float32Array([1,1]);
    mute.gain.value = 0;

    var that = this;
    drawer.onaudioprocess = this.buildProcessor();

    drawer.connect(mute);
    osc.connect(flattener);
    flattener.connect(tester);
    tester.connect(drawer);
    flattener.connect(mute);
    mute.connect(actx.destination);
    osc.start(0);
  };

  EnvelopeDrawer.prototype.moveTo = function (x,y) {
    this.canvas2dContext.moveTo((x+this.offsetX) * 44100 / this.zoomX, this.height - (y + this.offsetY) * this.zoomY);
  };

  EnvelopeDrawer.prototype.lineTo = function (x,y) {
    this.canvas2dContext.lineTo((x+this.offsetX) * 44100 / this.zoomX, this.height - (y + this.offsetY) * this.zoomY);
  };

  EnvelopeDrawer.prototype.buildProcessor = function () {
    if (this.__terminate) this.__terminate();
    var running = true;
    this.__terminate = function () { running = false };
    var min = NaN;
    var max = NaN;
    var that = this;
    var initialized = false;
    return function (e) {
      if ( !running ) { console.log( '!!'); return; }
      if ( !initialized ) {
        that.playedSamples = 0;
        that.path = [];
        that.lastPos = [0,0];
        initialized = true;
      }
      var data = e.inputBuffer.getChannelData(0);
      for (var i=0;i<data.length;i++) {
        if ( isNaN(max) || max < data[i] ) max = data[i];
        if ( isNaN(min) || data[i] < min ) min = data[i];
        if ( that.playedSamples++ % that.zoomX === 0) {
          if ( !running ) { console.log('!!!'); return; }
          var x = that.playedSamples / 44100;
          that.path.push([x, min]);
          that.path.push([x, max]);
          min = NaN;
          max = NaN;
          that.drawPath();
        }
      }
    };
  };

  EnvelopeDrawer.prototype.reset = function () {
    this.resetting = true;
    var that = this;
    if ( this.animation ) {
      window.cancelAnimationFrame(this.animation);
      this.animation = false;
    }
    var newProcessor =  this.buildProcessor();
    that.canvas2dContext.clearRect(0,0,that.width,that.height);
    that.tester.disconnect();
    that.drawer.disconnect();
    that.drawer = that.audioContext.createScriptProcessor(that._processorSize);
    that.drawer.onaudioprocess = newProcessor;
    that.drawer.connect(that.mute);
    that.tester.connect(that.drawer);
    that.tester.gain.cancelScheduledValues(0);
    that.tester.gain.value = 0;
    that.resetting = false;
  };

  EnvelopeDrawer.prototype.drawPath = function () {
    if ( this.animation ) return;
    var toDraw = this.path;
    this.path = [];
    var that = this;
    this.animation = window.requestAnimationFrame( function(timestamp) {
      if ( that.resetting ) { console.log('!1'); }
      if ( toDraw.length ) {
        var ctx = that.canvas2dContext;
        ctx.beginPath();
        that.moveTo( that.lastPos[0], that.lastPos[1]);
        var len = toDraw.length;
        for ( var i=0;i<len;i++ ) {
          that.lineTo( toDraw[i][0], toDraw[i][1]);
        }
        if ( that.resetting ) { console.log('!2'); return; }
        ctx.stroke();
        that.lastPos = [ toDraw[len-1][0], toDraw[len-1][1] ];
      }
      that.animation = false;
    });
  };

  EnvelopeDrawer.prototype.draw = function (fn) {
    this.reset();
    fn(this.audioContext, this.tester.gain);
  };



  var EnvelopeSimDrawer = function (canvas2dContext) {
    this.canvas2dContext = canvas2dContext;
    this.zoomX = 128;
    this.zoomY = 64;
    this.height = this.canvas2dContext.canvas.height;
    this.width = this.canvas2dContext.canvas.width;
  };

  EnvelopeSimDrawer.prototype.lineTo = function (x,y) {
    this.canvas2dContext.lineTo((x+this.offsetX) * 44100 / this.zoomX, this.height - (y + this.offsetY) * this.zoomY);
  };

  EnvelopeSimDrawer.prototype.draw = function (points) {
    var ctx = this.canvas2dContext;
    ctx.beginPath();
    var starts = [];
    var ends = [];
    for ( var i=0;i<points.length;i++ ) {
      var p=points[i];
      if ( p.type === 'set' || p.type === 'target' ) {
        starts.push(p);
      }
      else {
        ends.push(p);
      }
    }
    var mode = 'set';
    var x = 0, y = 0;
    ctx.moveTo(0,0);
    var running;
    for ( var i=0; i < points.length; i++ ) {
      var p = points[i];
      var n = points[i+1];
      if ( 'undefined' === typeof n ) {
        n = {type: 'end', x: this.width * this.zoomX / 44100, y:1};
      }
      switch ( p.type ) {
        case 'set':
          //if ( n.type === 'linear' || n.type === 'exponential' ) {
            this.lineTo(p.x, y);
            this.lineTo(p.x, p.y);
          //}
          x = p.x;
          y = p.y;
          break;
          running = true;

        case 'linear':
          x = p.x;
          y = p.y;
          this.lineTo(x, y);
          mode = 'linear';
          running = false;
          break;
        case 'exponential':
          if ( y <= 0 ) break;
          var v0 = y;
          var v1 = p.y;
          var t0 = x;
          var t1 = p.x;
          var st0 = 44100 * t0 / this.zoomX;
          var st1 = 44100 * t1 / this.zoomX;
          for ( var st = Math.floor(st0) + 1;st<st1;st++ ) {
            var t = st * this.zoomX / 44100;
            var v = v0 * Math.pow( v1/v0, (t - t0) / (t1 - t0));
            this.lineTo(t, v);
          }
          x = p.x;
          y = p.y;
          running = false;
          break;
        case 'target':
          this.lineTo(p.x, y);
          if ( n.type === 'linear' || n.type === 'exponential' ) {
            this.lineTo(p.x, p.y);
            x = p.x;
            y = p.y;
            break;
          }
          var v0 = y;
          var v1 = p.y;
          var t0 = p.x;
          var t1 = n.x;
          var st0 = 44100 * t0 / this.zoomX;
          var st1 = 44100 * t1 / this.zoomX;
          for ( var st = Math.floor(st0) + 1;st<st1;st++ ) {
            var t = st * this.zoomX / 44100;
            var v = v1 + (v0 - v1) * Math.exp( -1 * (t-t0)/p.c);
            this.lineTo(t,v);
          }
          x = t1;
          y = v;
          break;
        default:
      }
      if ( n.type === 'end' ) {
        this.lineTo(999999, p.y);
      }
    }
    ctx.stroke();
  };

  var GridDrawer = function (canvas2dContext) {
    this.canvas2dContext = canvas2dContext;
    this.zoomX = 128;
    this.zoomY = 64;
    this.height = this.canvas2dContext.canvas.height;
    this.width = this.canvas2dContext.canvas.width;
  };

  GridDrawer.prototype.moveTo = function (x,y) {
    this.canvas2dContext.moveTo((x+this.offsetX) * 44100 / this.zoomX, this.height - (y + this.offsetY) * this.zoomY);
  };

  GridDrawer.prototype.lineTo = function (x,y) {
    this.canvas2dContext.lineTo((x+this.offsetX) * 44100 / this.zoomX, this.height - (y + this.offsetY) * this.zoomY);
  };

  GridDrawer.prototype.drawHorizontalLine = function (y) {
    var ctx = this.canvas2dContext;
    ctx.beginPath();
    this.moveTo(-this.offsetX,y);
    this.lineTo((this.width * this.zoomX / 44100) - this.offsetX, y);
    ctx.stroke();
    ctx.fillText(parseFloat(y).toString(), 5, this.height - ( y + this.offsetY) * this.zoomY - 8);

  };

  GridDrawer.prototype.drawVerticalLine = function (x) {
    var ctx = this.canvas2dContext;
    ctx.beginPath();
    var xx = (x + this.offsetX) * 44100 / this.zoomX;
    ctx.moveTo(xx, 0);
    ctx.lineTo(xx,this.height);
    ctx.stroke();
    ctx.fillText(x.toString(), xx, this.height - 10);
  };

  GridDrawer.prototype.draw = function () {
    var ctx = this.canvas2dContext;
    ctx.beginPath();
    var w = this.width * this.zoomX / 44100 - this.offsetX * this.zoomX / 44100;
    var left =  - this.offsetX;
    var right = this.width * this.zoomX / 44100 - this.offsetX;

    var spanX = Math.pow(10,Math.round(Math.log10(200 * this.zoomX / 44100 )));

    var spanX2 = Math.pow(10,Math.round(Math.log10(300 * this.zoomX / 44100))) / 2;

    spanX = spanX < spanX2 ? spanX : spanX2;
    for ( var x = 0; left<x; x-=spanX ) {
      if (x < right ) this.drawVerticalLine(x);
    }
    for ( var x = 0; x<right; x+=spanX ) {
      if ( left < x ) this.drawVerticalLine(x);
    }


    var h = this.height / this.zoomY - this.offsetX / this.zoomY;
    var top =  - this.offsetY;
    var bottom = this.height / this.zoomY - this.offsetY;
    var spanY = Math.pow(10,Math.round(Math.log10(200 / this.zoomY)));
    var spanY2 = Math.pow(10,Math.round(Math.log10(300 / this.zoomY))) / 2;

    spanY = spanY < spanY2 ? spanY : spanY2;
    for ( var y = 0; top<y; y-=spanY ) {
      if (y < bottom ) this.drawHorizontalLine(y);
    }
    for ( var y = 0; y<bottom; y+=spanY ) {
      if ( top < y ) this.drawHorizontalLine(y);
    }


  };

  window.EnvelopeDrawer = EnvelopeDrawer;
  window.EnvelopeSimDrawer = EnvelopeSimDrawer;
  window.GridDrawer = GridDrawer;

})();
