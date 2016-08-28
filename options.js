function save_options() {
  var anchorFmt = document.getElementById('anchorFmt').value;
  var textFmt = document.getElementById('textFmt').value;
  chrome.storage.sync.set({
    'anchorFmt': anchorFmt,
    'textFmt': textFmt
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function load_options() {
  chrome.storage.sync.get({
    'anchorFmt': 'title_url',
    'textFmt': 'url'
  }, function(options) {
    document.getElementById('anchorFmt').value = options.anchorFmt;
    document.getElementById('textFmt').checked = options.textFmt;
  });
}

document.addEventListener('DOMContentLoaded', load_options);
document.getElementById('save').addEventListener('click',
    save_options);