var options = undefined;
var loadOptions = function loadOptions(opts) {
  if (!options) {
    options = {};
  }
  options = Object.assign(options, opts);
  console.log("Options updated with ", opts, " now ", options);
};

// TODO: investigate if we can have a race condition where we get a click before
// options load from storage; we would need promises or something to deal with this.
var DEBUG_start = Date.now();
console.log("before: " + (Date.now()-DEBUG_start));
// defaults
chrome.storage.sync.get({
    'anchorFmt': 'title_url',
    'textFmt': 'url'
}, function syncComplete(retrieved) {
  console.log("retrieved: " + (Date.now()-DEBUG_start));
  loadOptions(retrieved);
});
console.log("after: " + (Date.now()-DEBUG_start));

chrome.storage.onChanged.addListener(function storageChanged(changes, area) {
  newOpts = {};
  for (k in changes) {
    if (changes[k].newValue != changes[k].oldValue) {
      newOpts[k] = changes[k].newValue;
    }
  }
  loadOptions(newOpts);
});

// used to pass values from the click handler to the copy event handler
var clipProxy = {
  'text': "",
  'html': ""
};

document.addEventListener('copy', function docCopy(e){
    e.clipboardData.setData('text/plain', clipProxy.text);
    e.clipboardData.setData('text/html', clipProxy.html);
    e.preventDefault(); // We want our data, not data from any selection, to be written to the clipboard
});

var bkPage = chrome.extension.getBackgroundPage();

var getIconImage = function getIconImage(config, alpha) {
  var size = config['size'];
  var context = config['canvas'].getContext('2d');
  context.clearRect(0, 0, size, size);

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

var getElemForSize = function getElemForSize(name, size) {
  return bkPage.document.getElementById(name + size);
};

var buildConfig = function buildConfig(size) {
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

var updateIcon = function updateIcon(alpha) {
  chrome.browserAction.setIcon({
    imageData: {
      '19': getIconImage(iconSizeConfigs['19'], alpha),
      '38': getIconImage(iconSizeConfigs['38'], alpha)
    }
  });
};

var animateCheck = function animateCheck() {
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

chrome.browserAction.onClicked.addListener(function iconClickListener(tab) {
  console.log("clicked: " + (Date.now()-DEBUG_start));
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
    
    // crap, options haven't loaded yet; need promises here?
    if (options == undefined) {
      console.log("Options not yet available, bailing");
      return;
    }
    
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
    if (options['anchorFmt'] == 'title') {
      anchor.textContent = title;
    } else if (options['anchorFmt'] = 'title_url') {
      anchor.textContent = title + " (" + url + ")";
    } else {
      console.log("Unknown option for anchorFmt: ", options['anchorFmt']);
      return;
    }
    
    if (options['textFmt'] == 'url') {
      clipProxy.text = url;
    } else if (options['textFmt'] == 'markdown') {
      clipProxy.text = "[" + title + "](" + url + ")";
    } else {
      console.log("Unknown option for textFmt: ", options['textFmt']);
      return;
    }
    clipProxy.html = container.innerHTML;
    
    var success = false;
    try {
      // https://developers.google.com/web/updates/2015/04/cut-and-copy-commands?hl=en
      success = bkPage.document.execCommand("copy");
      if (!success) {
        console.log("Couldn't copy");
      }
    } catch (e) {
      console.log("Couldn't copy due to error " + e);
    }
    // TODO add failure icon or some kind of status reporting
    if (!success) {
      return;
    }
    animateCheck();
  });
});

chrome.runtime.onSuspend.addListener(function suspendListener() {
  // in case we get suspended while animating, clear icon check
  updateIcon(0);
});
