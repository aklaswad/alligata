( function () {

/*
Notice: currently Chrome can't create over around a thousand of offlineAudioContext.

https://code.google.com/p/chromium/issues/detail?id=433479&q=OfflineAudioContext&colspec=ID%20Pri%20M%20Week%20ReleaseBlock%20Cr%20Status%20Owner%20Summary%20OS%20Modified
*/



/*

  var job = new OfflineJob({
    before: function ([done]) {},
    work: function (ctx,done) {},
    after: function (e,[done]) {},
    channels: 2,
    length: 44100,
    samplerate: 44100
  });

*/

  var totalJobs = 0;
  var runningJobs = 0;
  var jobQueue = [];
  var maxWorkers = 256;
  var ctxPool = [];

  function enqueue(job) {
    jobQueue.push(job);
    dequeue();
  }

  // XXX: XXX
  function isChrome() {
    return true;
  }

  // TODO: timeout?
  function dequeue() {
    if ( maxWorkers < runningJobs ) return;
    if ( jobQueue.length <= 0 ) return;
    runningJobs++;
    if ( isChrome() && 800 < totalJobs ) {
      this.deque = function () { /* no-op */ };
      throw('Currently Chrome has a fatal bug to create lots of offlineAudioContexts. I stop doing more jobs. You are now going to that limitation which crushes the process');
    }
    var job = jobQueue.shift();
    job.__exec(ctx,function () {
      runningJobs--;
      totalJobs++;
    });
  };

  function OfflineJobMaxWorkers (newValue) {
    // TODO: more validation
    if ( 'undefined' !== typeof newValue ) {
      maxWorkers = newValue;
    }
    return newValue;
  }

  function OfflineJob (opts) {
    return this.init(opts);
  }

  OfflineJob.prototype.init = function (opts) {
    this.channels = opts.channels || 2;
    this.length = opts.lenth || 44100;
    this.samplerate = opts.samplerate || 44100;
    this.work = opts.work;
    this.after = opts.after;
    return this;
  };

  OfflineJob.prototype.__exec = function (done) {
    var ctx = new OfflineAudioContext(this.channels,this.length,this.samplerate);
    var that = this;
    ctx.oncomplete = function (e) {
      that.after(e);  // TODO: support Async
      done();
    };
    ctx.startRendering();
  }

  OfflineJob.prototype.run = function () {
    enqueue(this);
  };

  function OfflineJobSet (opts) {}

  OfflineJobSet.prototype.add;
  OfflineJobSet.prototype.map;
  OfflineJobSet.prototype.reduce;
  OfflineJobSet.prototype.run;

  window.Alligata.OfflineJob = OfflineJob;
  window.Alligata.OfflineJobSet = OfflineJobSet;
  window.Alligata.OfflineJobMaxWorkers = OfflineJobMaxWorkers
})();
