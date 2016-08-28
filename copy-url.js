var clipProxy = {
  'url': "",
  'html': ""
};

document.addEventListener('copy', function(e){
    e.clipboardData.setData('text/plain', clipProxy.url);
    e.clipboardData.setData('text/html', clipProxy.html);
    e.preventDefault(); // We want our data, not data from any selection, to be written to the clipboard
});

var bkPage = chrome.extension.getBackgroundPage();

var getIconImage = function(config, alpha) {
  var size = config['size'];
  var context = config['canvas'].getContext('2d');
  context.clearRect(0, 0, size, size);
  // ...draw to the canvas...
  var savedAlpha = context.globalAlpha;
  context.globalAlpha = 1.0;
  context.drawImage(config['icon'], 0, 0);
  if (alpha > 0) {
    context.globalAlpha = alpha;
    context.drawImage(config['check'], 0, 0);
  }
  context.globalAlpha = savedAlpha;
  return context.getImageData(0, 0, size, size);
};

var getElemForSize = function(name, size) {
  return bkPage.document.getElementById(name + size);
};

var buildConfig = function(size) {
  var config = {};
  config['size'] = size;
  config['canvas'] = getElemForSize('canvas', size);
  config['icon'] = getElemForSize('icon', size);
  config['check'] = getElemForSize('check', size);
  return config;
};

var iconSizeConfigs = {
  19: buildConfig(19),
  38: buildConfig(38)
};

var updateIcon = function(alpha) {
  chrome.browserAction.setIcon({
    imageData: {
      '19': getIconImage(iconSizeConfigs['19'], alpha),
      '38': getIconImage(iconSizeConfigs['38'], alpha)
    }
  });
};

var animateCheck = function() {
  var startMs = Date.now();
  var FADE_IN = 100;
  var HOLD = 500;
  var FADE_OUT = 400;
  var FREQ_MS = 25;
  var again = true;
  var draw = function() {
    var elapsed = Date.now() - startMs;
    var alpha;
    if (elapsed < FADE_IN) {
      alpha = elapsed / FADE_IN;
    } else if (elapsed < FADE_IN + HOLD) {
      alpha = 1.0;
    } else if (elapsed < FADE_IN + HOLD + FADE_OUT) {
      alpha = 1.0 - (elapsed - FADE_IN - HOLD)/FADE_OUT;
    } else {
      alpha = 0;
      again = false;
    }
    updateIcon(alpha);
    if (again) {
      bkPage.setTimeout(draw, FREQ_MS);
    }
  }
  draw();
  bkPage.setTimeout(draw, FREQ_MS);
}

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.query({'active': true, 'currentWindow': true}, function(tabs) {
    if (tabs.length < 1) {
      console.log("Got no tabs");
      return;
    }
    if (tabs.length > 1) {
      console.log("Got %d tabs", tabs.length);
    }

    var anchor = bkPage.document.getElementById("anchor");
    var container = bkPage.document.getElementById("copyContainer");
    
    var url = tabs[0].url;
    if (url == undefined) {
      console.log("Didn't get an url from active tab");
      return;
    }
    anchor.href = url;
    
    var title = tabs[0].title;
    if (title == undefined) {
      console.log("Didn't get an url from active tab");
      return;
    }
    anchor.textContent = title + " (" + url + ")";
    
    clipProxy.url = url;
    clipProxy.html = container.innerHTML;
    
    var success = false;
    bkPage.getSelection().selectAllChildren(container);
    try {
      // https://developers.google.com/web/updates/2015/04/cut-and-copy-commands?hl=en
      success = bkPage.document.execCommand("copy");
      if (!success) {
        console.log("Couldn't copy");
      }
    } catch (e) {
      console.log("Couldn't copy due to error " + e);
    }
    if (!success) {
      return;
    }
    animateCheck();
  });
});

chrome.runtime.onSuspend.addListener(function() {
  // in case we get suspended while animating, clear icon check
  updateIcon(0);
});
