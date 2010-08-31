document.body.bgColor='red';
//alert(document.body.innerHTML);
//alert(document.body.innerHTML);
chrome.extension.sendRequest({method: 'store', arg: 'hello', 
            arg2: document.body.innerHTML + document.head.innerHTML}, function(response) {});
