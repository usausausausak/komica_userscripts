// ==UserScript==
// @name         Komica neo form
// @namespace    https://github.com/usausausausak
// @description  Post form with utils on komica
// @version      0.1.5
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require      https://github.com/usausausausak/neo/raw/97d8aed71a4bfe65316caead4fb6eea3b048ddc1/neo/dist/PaintBBS-1.2.6.js
// @resource     paintbbs.css https://github.com/usausausausak/neo/raw/97d8aed71a4bfe65316caead4fb6eea3b048ddc1/neo/dist/PaintBBS-1.2.6.css
// @include      http://*.komica.org/*/*.htm*
// @include      https://*.komica.org/*/*.htm*
// @include      http://*.komica2.net/*/*.htm*
// @include      https://*.komica2.net/*/*.htm*
// @include      http://*.komica.org/*/pixmicat.php?page_num=*
// @include      https://*.komica.org/*/pixmicat.php?page_num=*
// @include      http://*.komica2.net/*/pixmicat.php?page_num=*
// @include      https://*.komica2.net/*/pixmicat.php?page_num=*
// @include      http://*.komica.org/*/pixmicat.php?res=*
// @include      https://*.komica.org/*/pixmicat.php?res=*
// @include      http://*.komica2.net/*/pixmicat.php?res=*
// @include      https://*.komica2.net/*/pixmicat.php?res=*
// @include      https://2cat.ml/*/*/*.htm*
// @include      https://2cat.ml/*/*/pixmicat.php?page_num=*
// @include      https://2cat.ml/*/*/pixmicat.php?res=*
// @include      http://www.camiko.org/*/*.htm*
// @include      http://www.camiko.org/*/*.php?page_num=*
// @include      http://www.camiko.org/*/*.php?res=*
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceURL
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.getResourceUrl
// @grant        GM.addStyle
// ==/UserScript==
(function (window) {
    "use strict";
    const TAG = "[Komica_neoform]";
    const SUBMIT_TIMEOUT = 30 * 1000;

    const BLANK_IMG =
        "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=";

    const pngOptions = { mimeType: "image/png", };
    const jpgOptions = { mimeType: "image/jpeg", quality: 0.9 };

    // i dont know why GM.getResourceText not work
    // so copy from https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
    function getResourceText(url) {
        return GM.getResourceUrl(url)
            .then(url => fetch(url))
            .then(resp => resp.text())
            .catch(function(error) {
                console.log('Request failed', error);
                return null;
            });
    }

    function createFunctionButton(title, text, func) {
        const button = document.createElement("span");
        button.className = "text-button";
        button.title = title;
        button.innerHTML = `[${text}]`;
        button.style = "font-size: 1em;"
        button.addEventListener("click", func);
        return button;
    }

    function setBlobImage(blob = null, info = null) {
        const upurlField = document.getElementById("neoform-upurl");
        const image = document.getElementById("neoform-blob-image");

        image.blob = blob;
        if (blob) {
            const size = Math.ceil(blob.size / 1024);
            image.src = URL.createObjectURL(blob);
            image.title = `Size: ${size} KiB`;
            image.style.display = "";

            if ((info) && (upurlField)) {
                upurlField.value = info;
            }
        } else {
            image.src = BLANK_IMG;
            image.title = "";
            image.style.display = "none";

            if (upurlField) {
                upurlField.value = "";
            }
        }
    }

    // add upload from url field
    function loadRemoteImage(src) {
        console.log(TAG, `Load remote image: ${src}`);
        GM.xmlHttpRequest({
            method: "GET",
            responseType: "blob",
            url: src,
            onload: function (ev) {
                if (ev.status === 200) {
                    console.log(TAG, "Remote image load.");
                    setBlobImage(ev.response);
                }
            }
        });
    }

    function renderImage(image, method = null, options = pngOptions) {
        console.log(TAG, `Render image: ${image.width} x ${image.height}`);

        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext("2d");
        if (typeof method === "function") {
            method(canvas, ctx, image, image.width, image.height);
        } else {
            ctx.drawImage(image, 0, 0);
        }

        const mimeType = options.mimeType || "image/png";
        const quality = options.quality || 1;

        canvas.toBlob(function (blob) {
                const upfileField =
                    document.querySelector("form input[name=upfile]");
                upfileField.value = "";

                setBlobImage(blob, "[rendered image]");
            }, mimeType, quality);
    }

    function renderBlob(blob, method = null, options = pngOptions) {
        const image = new Image();
        image.onload = function() {
            window.URL.revokeObjectURL(this.src);
            try {
                renderImage(this, method, options);
            } catch (ex) {
                console.log(TAG, ex);
            }
        }
        image.onerror = function() {
            window.URL.revokeObjectURL(this.src);
            console.log(TAG, "Render image error.");
        }
        image.src = URL.createObjectURL(blob);
    }

    function renderUpfile(method = null, options = pngOptions) {
        if (upfileField.files.length === 0) {
            // no upfile, use upurl's image
            const blobImage =
                document.getElementById("neoform-blob-image");
            if (!blobImage.blob) {
                console.log(TAG, "No image.");
                return;
            }

            renderBlob(blobImage.blob, method, options);
        } else {
            const file = upfileField.files[0];
            if (!file.type.match(/^image\//)) {
                console.log(TAG, "No image.");
                return;
            }

            renderBlob(file, method, options);
        }
    }

    // modifty submit form
    function dismissMessage() {
        const msgBlock = document.getElementById("neoform-message");
        if ((!msgBlock) || (!msgBlock.parentElement)) {
            return;
        }
        msgBlock.parentElement.removeChild(msgBlock);
    }

    function showMessage(msg, stick = false) {
        let msgBlock = document.getElementById("neoform-message");
        if (!msgBlock) {
            msgBlock = document.createElement("div");
            msgBlock.id = "neoform-message";
            msgBlock.style.cssText =
                `position: absolute;
                 width: 70%; min-height: 10em; left: 15%;
                 display: flex; flex-direction:
                 column; justify-content: center;
                 align-items: center;
                 font-weight: bold;
                 background-color: rgba(238, 170, 136, 0.8);`;

            const insertPoint =
                document.querySelector("form input[type=submit]");
            insertPoint.parentElement.insertBefore(msgBlock,
                insertPoint.parentElement.firstChild);
        }
        msgBlock.innerHTML = `<div>${msg}</div>`;

        if (!stick) {
            msgBlock.addEventListener("click", dismissMessage, false);
        }
    }

    function showSubmitResult(req, form) {
        let res = req.statusText;
        let treatAsPost = false;

        const xml = req.responseXML;
        if (xml) {
            const errText = xml.querySelector("#error span, center b");
            if (errText) {
                res = errText.innerHTML.replace(/<a.*\/a>/, "");
                console.log(TAG, `Submit fail: ${res}`)
            } else {
                res = xml.documentElement.innerHTML;
                treatAsPost = true;
                console.log(TAG, "Submit ok.")
            }
        }

        showMessage(res);

        if (treatAsPost) {
            setTimeout(dismissMessage, 1000);

            form.reset();
            setBlobImage();

            // post is submit, try to get new posts
            window.postMessage( { event: "fetch-new-posts" }, "*");
        } else {
            // post fail, try to reload recaptch
            window.postMessage( { event: "reload-recaptcha" }, "*");
        }
    }

    function submitForm(form) {
        const actionUrl = form.action;
        const formData = new FormData(form);

        const textOnly = formData.get("noimg") === "on" ||
                       formData.get("textonly") === "on";
        const upurl = document.getElementById("neoform-upurl").value;
        if (textOnly) {
            formData.delete(upfileField.name);
        } else if (upurl !== "") {
            const image = document.getElementById("neoform-blob-image");
            if ((!image) || (!image.blob)) {
                showMessage("Something is wrong with image.");
                return;
            }
            formData.set(upfileField.name, image.blob);
        } else if (upfileField.files.length === 0) {
            formData.delete(upfileField.name);
        }

        const comField = document.getElementById("fcom");
        if (comField) {
            if ((comField.value === "")
                && (!formData.has(upfileField.name))) {
                showMessage("Please write or upload something.");
                return;
            }
        }

        console.log(TAG, `Submiting to ${actionUrl}.`);
        showMessage(`Submiting to ${actionUrl}.`, true);

        const req = new XMLHttpRequest();
        req.open("post", actionUrl, true);
        req.responseType = "document";
        req.timeout = SUBMIT_TIMEOUT;
        req.onload = function () {
            if(((this.status >= 200) && (this.status < 300)) ||
               (this.status == 304)) {
                try {
                    showSubmitResult(this, form);
                } catch (ex) {
                    showMessage("Submit fail.");
                    console.log(TAG, `Submit error: ${ex}.`);
                }
            } else {
                showMessage(`Submit fail: ${this.statusText}`);
                console.log(TAG, `Submit error: ${this.statusText}.`);
            }
        };
        req.onerror = function () {
            showMessage("Submit fail.");
            console.log(TAG, "Submit error.");
        };
        req.ontimeout = function () {
            showMessage("Timeout.");
            console.log(TAG, "Submit timeout.");
        };
        req.send(formData);
    }

    function submitFormCb(ev) {
        ev.preventDefault();
        submitForm(this);
    }

    function initForm() {
        const form = document.querySelector("form");
        if (form) {
            form.removeEventListener("submit", submitFormCb, false);
            form.addEventListener("submit", submitFormCb, false);
        }
    }

    function isPainterShowing() {
        const el = document.getElementById("neoform-painter");
        return ((el) && (el.style.display !== "none"));
    }

    function showPainter(show) {
        const form = document.querySelector("form");
        const el = document.getElementById("neoform-painter");
        if (el) {
            el.style.display = show ? "flex" : "none";
            document.paintBBSRunning = isPainterShowing();
        }
        if (form) {
            form.style.display = isPainterShowing() ? "none" : "";
        }
    }

    function startPainter() {
        // init only run once
        const dummy = document.getElementById("neoform-painter-dummy");
        if (dummy) {
            getResourceText("paintbbs.css")
                .then(css => GM.addStyle(css))
                .then(() => {
                    document.neo.init();
                    document.neo.start(false);
                    showPainter(true);
                })
                .catch(ex => {
                    console.log(TAG, ex);
                    // no more change
                    dummy.parentElement.removeChild(dummy);
                });
        } else if (document.getElementById("NEO")) {
            showPainter(true);
        }
    }

    // init form utils
    const upfileField =
        document.querySelector("form:first-of-type input[name=upfile]");
    if (upfileField) {
        let cell = upfileField.parentElement;
        cell.align = "left";

        // painter form
        {
            const form = document.createElement("form");
            form.style.cssText = "margin-top: 5px; margin-bottom: 5px";

            let widthField = document.createElement("input");
            widthField.type = "number";
            widthField.value = 300;
            widthField.min = 300;
            widthField.step = 100;
            widthField.required = true;
            form.appendChild(widthField);

            form.appendChild(document.createTextNode(" x "));

            let heightField = document.createElement("input");
            heightField.type = "number";
            heightField.value = 300;
            heightField.min = 300;
            heightField.step = 100;
            heightField.required = true;
            form.appendChild(heightField);

            form.appendChild(document.createTextNode(" "));

            const btn = document.createElement("button");
            btn.textContent = "お描きする";
            form.addEventListener("submit", ev => {
                ev.preventDefault();
                const dummy =
                    document.getElementById("neoform-painter");
                if (dummy) {
                    let width;
                    let height;
                    try {
                        width = parseInt(widthField.value);
                        height = parseInt(heightField.value);
                    } catch (ex) {
                        return;
                    }

                    const widthParam =
                        dummy.querySelector("[name=image_width]");
                    const heightParam =
                        dummy.querySelector("[name=image_height]");
                    if ((widthParam) && (heightParam)) {
                        widthParam.value = width;
                        heightParam.value = height;
                    }

                    dummy.setAttribute("width", width + 200);
                    dummy.setAttribute("height", height + 200);
                    widthField.disabled = true;
                    heightField.disabled = true;
                }
                startPainter();
            });
            form.appendChild(btn);

            cell.appendChild(form);
        }

        // upload from internet field
        const input = document.createElement("input");
        input.id = "neoform-upurl";
        input.type = "text";
        input.size = "28";
        input.placeholder = "or upload from internet";
        input.addEventListener("change", ev => {
            upfileField.value = "";
            image.blob = null;
            image.src = "";
            if (input.value !== "") {
                loadRemoteImage(input.value);
            }
        }, false);

        // preview rendered image
        const image = new Image();
        image.id = "neoform-blob-image";
        image.src = BLANK_IMG;
        image.style.cssText =
            "display: none; border: 1px dotted black; max-width: 1em; max-height: 1em; vertical-align: middle;";
        image.blob = null;
        image.onload = function() {
            window.URL.revokeObjectURL(image.src);
        }
        image.onerror = function() {
            image.blob = null;
            if (image.src !== "") {
                window.URL.revokeObjectURL(image.src);
                //image.src = ""; // will fire onerror persistently
                image.style.display = "none";
            }
        }

        cell.appendChild(input);
        cell.appendChild(image);

        // clear upurl if upfile change
        upfileField.addEventListener("change", ev => {
            if (upfileField.files.length === 0) {
                return;
            }

            setBlobImage();
        }, false);

        // image edit buttons
        cell = cell.previousSibling;
        cell.appendChild(document.createElement("br"));

        cell.appendChild(createFunctionButton("Rerender png", "p",
            ev => renderUpfile()));

        cell.appendChild(createFunctionButton("Rerender jpg", "j",
            ev => renderUpfile(null, jpgOptions)));

        cell.appendChild(createFunctionButton("Flip", "f",
            ev => {
                renderUpfile((canvas, ctx, img, w, h) => {
                    ctx.setTransform(-1, 0, 0, 1, w, 0);
                    ctx.drawImage(img, 0, 0);
                });
            }));

        cell.appendChild(createFunctionButton("Rotate 90 angle", "r",
            ev => {
                renderUpfile((canvas, ctx, img, w, h) => {
                    canvas.width = h;
                    canvas.height = w;
                    ctx.translate(h / 2,w / 2);
                    ctx.rotate(90  * Math.PI / 180);
                    ctx.drawImage(img, (-w) / 2, (-h) / 2);
                });
            }));
    }

    // init painter
    {
        const painterBlock = document.createElement("div");
        painterBlock.id = "neoform-painter";
        painterBlock.style.cssText =
            "display: none; flex-direction: column; border-bottom: 1px solid black; padding-bottom: 10px; margin-bottom: 10px; align-items: center;";

        const controlBlock = document.createElement("div");
        controlBlock.style.cssText = "margin: 10px";

        const quitBtn = document.createElement("button");
        quitBtn.textContent = "Discard";
        quitBtn.addEventListener("click", ev => {
            showPainter(false);
        });
        controlBlock.appendChild(quitBtn);

        function painterAddParam(painterEl, key, value) {
            const el = document.createElement("param");
            el.setAttribute("name", key);
            el.setAttribute("value", value);
            painterEl.appendChild(el);
        }

        const painter = document.createElement("applet-dummy");
        painter.id = "neoform-painter-dummy";
        painter.setAttribute("name", "paintbbs");
        painter.setAttribute("width", "500");
        painter.setAttribute("height", "500");
        painterAddParam(painter, "image_width", 300);
        painterAddParam(painter, "image_height", 300);

        painterBlock.appendChild(controlBlock);
        painterBlock.appendChild(painter);

        if ((upfileField) && (upfileField.form)) {
            const form = upfileField.form;
            form.parentElement.insertBefore(painterBlock, form);
        }

        // no translate
        document.neo.translate = str => str;

        // submit to my form
        document.paintBBSSubmit = function (board, blob, thumbnail, thumbail2) {
            console.log(TAG, "Submit paint.");
            showPainter(false);
            setBlobImage(blob, "[from painter]");
        }
    }

    initForm();

    // notify will remove form event, reset when notify occar
    function scriptMessageCb(ev) {
        const event = ev.data;
        if (event.event === "notify-new-posts") {
            initForm();
        }
    }

    window.addEventListener("message", scriptMessageCb, false);
})(window);
