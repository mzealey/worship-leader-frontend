abc2svg is in a fossil repository which is a pain if you're not familiar with it. The scripts here is based on the
following version and changes. The latest 2026 versions don't export (or even have?) the required classes:

repository:   abc2svg.fossil
checkout:     433944c7887548a56818c4e32cf0fb462a531c1d 2019-02-01 15:55:06 UTC
parent:       83a7d2efe0488234e4403a017790bc3fa2161e65 2019-02-01 14:01:32 UTC
child:        2c9cf4bafe7d746377eb9f6e02fbdea88a5fe603 2019-02-06 14:25:50 UTC
tags:         trunk, v1.19.1
comment:      New release v1.19.1 (user: jef)
EDITED     util/toaudio.js
EDITED     util/toaudio5.js

$ fossil diff
Index: util/toaudio.js
==================================================================
--- util/toaudio.js
+++ util/toaudio.js
@@ -289,10 +289,11 @@
 
        // add() main
 
        set_voices();                   // initialize the voice parameters
 
+    let rep_st_t;   // MZ: Unsure what this is for but crashes as not defined
        if (!a_e) {                     // if first call
                a_e = []
                abc_time = rep_st_t = p_time = 0;
                play_factor = C.BLEN / 4 * 120 / 60     // default: Q:1/4=120
        } else if (s.time < abc_time) {


This code was merged upstream at some point

Index: util/toaudio5.js
==================================================================
--- util/toaudio5.js
+++ util/toaudio5.js
@@ -397,18 +397,30 @@
        play: function(istart, i_iend, a_e) {
                if (!a_e || istart >= a_e.length) {
                        onend()                 // nothing to play
                        return
                }
+
+               // play a null file to unlock the iOS audio
+               // This is needed for safari
+               function play_unlock() {
+                   var buf = ac.createBuffer(1, 1, 22050),
+                       src = ac.createBufferSource();
+                       src.buffer = buf;
+                       src.connect(ac.destination);
+                       src.start(0)
+               }
 
                // initialize the audio subsystem if not done yet
-               // (needed for iPhone/iPad/...)
                if (!gain) {
                        ac = conf.ac
-                       if (!ac)
+                       if (!ac) {
                                conf.ac = ac = new (window.AudioContext ||
                                                        window.webkitAudioContext);
+                if (navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1)
+                                       play_unlock()
+                       }
                        gain = ac.createGain();
                        gain.gain.value = conf.gain
                }
 
                iend = i_iend;
