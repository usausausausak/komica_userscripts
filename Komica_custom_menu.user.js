// ==UserScript==
// @name         Komica custom menu
// @namespace    https://github.com/usausausausak
// @description  Customize Komica's menu
// @include      http://komica.org/bbsmenu.html
// @include      https://komica.org/bbsmenu.html
// @include      http://*.komica.org/bbsmenu.html
// @include      https://*.komica.org/bbsmenu.html
// @version      0.1.1
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
(function (window) {
    "strict";
    const TAG = "[Komica_custom_menu]";

    class EventEmitter {
        constructor () {
            this._eventListener = {};
        }

        addListener(name, cb) {
            if (!this._eventListener[name]) {
                this._eventListener[name] = [];
            }

            if (typeof cb === "function") {
                this._eventListener[name].push(cb);
            } else {
                console.warn(TAG, "event listener not a function");
            }
            return this;
        }

        on(name, cb) {
            return this.addListener(`on${name}`, cb);
        }

        emit(name, ...args) {
            try {
                this._eventListener[name].forEach(cb => cb(...args));
            } catch (ex) {
                // drop exception
            }
        }
    }

    class ListSetting extends EventEmitter {
        constructor(name) {
            super();
            this._name = name;
            this._items = [];
            const json = GM_getValue(name, "");
            try {
                this._items = JSON.parse(json);
                console.log(TAG, `Setting "${name}" have ${this._items.length} items`);
            } catch(ex) {
                console.warn(TAG, `Error at parse setting "${name}"`);
            }
        }

        add(item) {
            this._items.push(item);
            this.save();
            this.emit("onadd", item);
        }

        remove(item) {
            this._items = this._items.filter(i => i !== item);
            this.save();
            this.emit("onremove", item);
        }

        removeIf(pred) {
            const newItems = [];
            const removalItems = [];
            for (let item of this._items) {
                if (pred(item)) {
                    removalItems.push(item);
                } else {
                    newItems.push(item);
                }
            }
            this._items = newItems;
            this.save();
            if (removalItems.length === 1) {
                this.emit("onremove", removalItems[0]);
            } else if (removalItems.length > 1) {
                this.emit("onclear", removalItems);
            }
        }

        clear() {
            this.emit("onclear", this._items);
            this._items = [];
            this.save();
        }

        save() {
            GM_setValue(this._name, JSON.stringify(this._items));
        }

        // unsafe
        get items() {
            return this._items;
        }

        get length() {
            return this._items.length;
        }

        [Symbol.iterator]() {
            return this._items[Symbol.iterator]();
        }

        forEach(cb) {
            this._items.forEach(cb);
        }

        find(pred) {
            return this.items.find(i => pred(i));
        }

        findIndex(pred) {
            return this.items.findIndex(i => pred(i));
        }
    }

    const settings = (function () {
        const favorites = new ListSetting("favorites");
        const hiddenLinks = new ListSetting("hiddenLinks");
        const hiddenCategorys = new ListSetting("hiddenCategorys");
        return {
            get favorites() {
                return favorites;
            },
            get hiddenLinks() {
                return hiddenLinks;
            },
            get hiddenCategorys() {
                return hiddenCategorys;
            },
        };
    })();

    // TODO
    // GM_addStyle not work in document-start
    {
        const observer = new MutationObserver(records => {
            for (let record of records) {
                if (record.target.nodeName === "BODY") {
                    GM_addStyle(`
body > font {
    display: none;
}

#custom-menu-setting {
    margin: 0;
    padding: 0 3px;
    color: #CC0000;
    cursor: pointer;
    opacity: 0.2;
    transition: all 200ms;
    position: absolute;
    top: 0;
    right: 0;
    background-color: #FFFFEE;
    border-top-left-radius: 20%;
    border-bottom-left-radius: 20%;
}

#custom-menu-setting:hover {
    opacity: 0.8;
    color: #FFFFEE;
    background-color: #CC0000;
}

.custom-menu-button {
    margin: 0 2px;
    color: #0000CC;
    opacity: 0.2;
    cursor: pointer;
    transition: all 200ms;
    visibility: hidden;
}

.custom-menu-button:hover {
    opacity: 0.8;
}

.custom-menu-category {
    margin-bottom: 1em;
    transition: all 200ms;
}

.custom-menu-category-name {
    color: #CC0000;
    font-weight: bold;
    white-space: nowrap;
    display: flex;
}

.custom-menu-category-hide {
    display: none;
}

.custom-menu-category-hide .custom-menu-category-name .custom-menu-button {
    opacity: 1;
    color: #CC0000;
}

.custom-menu-content {
    display: flex;
    flex-direction: column;
}

.custom-menu-link {
    display: flex;
}

.custom-menu-link a {
    white-space: nowrap;
    transition: all 100ms;
}

.custom-menu-link-fav .custom-menu-button:nth-child(2) {
    visibility: visible;
    opacity: 1;
    color: #CC0000;
}

.custom-menu-link-hide {
    display: none;
}

.custom-menu-link-hide .custom-menu-button:nth-child(3) {
    opacity: 1;
    color: #CC0000;
}

.custom-menu-customize #custom-menu-setting {
    opacity: 1;
    color: #FFFFEE;
    background-color: #CC0000;
    position: fixed;
}

.custom-menu-customize .custom-menu-button {
    visibility: visible;
}

.custom-menu-customize .custom-menu-category-hide {
    display: block;
    opacity: 0.5;
}

.custom-menu-customize .custom-menu-link a {
    margin-right: 5px;
}

.custom-menu-customize .custom-menu-link-hide {
    display: flex;
}

.custom-menu-customize .custom-menu-link-hide a {
    opacity: 0.2;
}
                    `);
                    observer.disconnect();
                    break;
                }
            }
        });
        observer.observe(document.documentElement,
                         { childList: true, subtree: true });
    }

    let categorys;
    // mapping: category name => links in category
    const categoryMap = new Map();

    function linkIdEqual(lhs, rhs) {
        return lhs[0] === rhs[0] && lhs[1] === rhs[1];
    }

    function createButtonElement(role, text, title) {
        const el = document.createElement("div");
        el.classList.add("custom-menu-button");
        el.dataset.customMenuButton = role;
        el.innerHTML = text;
        el.title = title;
        return el;
    }

    function createCategoryView(id) {
        const view = document.createElement("div");
        view.classList.add("custom-menu-category");
        view.dataset.customMenuCategory = id;
        return view;
    }

    function getCategoryViewFromName(name) {
        const index = categorys.findIndex(i => i.name === name);
        const view = document.getElementById(`custom-menu-category-${index}`);
        return view;
    }

    function getLinkViewFromId(id) {
        try {
            const el = categoryMap.get(id[0])
                .find(el => el.textContent === id[1]);
            return el.parentElement;
        } catch (ex) {
            console.error(TAG, ex);
            return null;
        }
    }

    function setLinkClass(id, className) {
        const view = getLinkViewFromId(id);
        view.classList.add(className);
    }

    function removeLinkClass(id, className) {
        const view = getLinkViewFromId(id);
        view.classList.remove(className);
    }

    function moveFavorite(linkId, dir) {
        const index = settings.favorites.findIndex(i => linkIdEqual(i, linkId));

        if (index === -1) {
            return;
        }

        const newIndex = index + dir;
        if ((newIndex < 0) || (newIndex >= settings.favorites.length)) {
            return;
        }

        // unsafe
        const items = settings.favorites.items;
        const a = items[index];
        items[index] = items[newIndex];
        items[newIndex] = a;
        settings.favorites.save();

        renderFavorite();
    }

    function favoriteButtonCb(ev) {
        const target = ev.target;
        const linkView = target.parentElement;
        const buttonRole = target.dataset.customMenuButton;

        const categoryId = linkView.dataset.customMenuCategory;
        const category = categorys[categoryId];

        const linkId = [category.name, linkView.firstChild.textContent];

        switch (buttonRole) {
            case "move-up-favorite-link":
                moveFavorite(linkId, -1);
                break;
            case "move-down-favorite-link":
                moveFavorite(linkId, +1);
                break;
            case "remove-favorite-link":
                settings.favorites.removeIf(item => linkIdEqual(item, linkId));
                break;
        }
    }

    function categoryButtonCb(ev) {
        if (!document.body.classList.contains("custom-menu-customize")) {
            return;
        }
        const target = ev.target;
        const linkView = target.parentElement;
        const buttonRole = target.dataset.customMenuButton;

        const categoryId = this.dataset.customMenuCategory;
        const category = categorys[categoryId];

        const linkId = [category.name, linkView.firstChild.textContent];

        switch (buttonRole) {
            case "toggle-favorite-link":
                if (linkView.classList.contains("custom-menu-link-fav")) {
                    settings.favorites.removeIf(
                        item => linkIdEqual(item, linkId));
                } else {
                    settings.favorites.add(linkId);
                }
                break;
            case "toggle-link":
                if (linkView.classList.contains("custom-menu-link-hide")) {
                    settings.hiddenLinks.removeIf(
                        item => linkIdEqual(item, linkId));
                } else {
                    settings.hiddenLinks.add(linkId);
                }
                break;
            case "toggle-category":
                if (this.classList.contains("custom-menu-category-hide")) {
                    settings.hiddenCategorys.remove(category.name);
                } else {
                    settings.hiddenCategorys.add(category.name);
                }
                break;
        }
    }

    function renderFavorite() {
        const links = [];
        for (let id of settings.favorites) {
            const view = getLinkViewFromId(id);
            if (view) {
                const categoryId = view.parentElement
                    .parentElement.dataset.customMenuCategory;
                const el = view.firstChild;
                links.push({ linkEl: el.cloneNode(true), categoryId });
            }
        }

        const view = document.getElementById("custom-menu-fav");
        view.innerHTML = "";

        if (links.length === 0) {
            return;
        }

        // render category name
        const nameView = document.createElement("div");
        nameView.classList.add("custom-menu-category-name");
        nameView.innerHTML = "お気に入り";

        // render content
        const contentView = document.createElement("div");
        contentView.classList.add("custom-menu-content");
        for (let link of links) {
            let { linkEl, categoryId } = link;
            const linkName = linkEl.textContent;

            const linkView = document.createElement("div");
            linkView.classList.add("custom-menu-link");
            linkView.dataset.customMenuCategory = categoryId;

            const moveUpButtonEl = createButtonElement(
                "move-up-favorite-link",
                /* UPWARDS BLACK ARROW */ "\u2B06",
                "上へ");
            const moveDownButtonEl = createButtonElement(
                "move-down-favorite-link",
                /* DOWNWARDS BLACK ARROW */ "\u2B07",
                "下へ");
            const favButtonEl = createButtonElement(
                "remove-favorite-link",
                /* NO ENTRY */ "\u26D4",
                "お気に入りから削除する");

            linkView.appendChild(linkEl);
            linkView.appendChild(favButtonEl);
            linkView.appendChild(moveUpButtonEl);
            linkView.appendChild(moveDownButtonEl);

            contentView.appendChild(linkView);
        }

        view.appendChild(nameView);
        view.appendChild(contentView);
    }

    function renderCategory(view, category) {
        view.innerHTML = "";

        // render category name
        const nameView = document.createElement("div");
        nameView.classList.add("custom-menu-category-name");
        nameView.innerHTML = category.name;

        const hideButtonEl = createButtonElement(
            "toggle-category",
            /* NO ENTRY */ "\u26D4",
            "カテゴリーを非表示に設定/解除");
        nameView.appendChild(hideButtonEl);

        // render content
        const contentView = document.createElement("div");
        contentView.classList.add("custom-menu-content");
        for (let linkEl of category.links) {
            const linkName = linkEl.textContent;

            const linkView = document.createElement("div");
            linkView.classList.add("custom-menu-link");

            const favButtonEl = createButtonElement(
                "toggle-favorite-link",
                /* BLACK STAR */ "\u2605",
                "お気に入りに追加/解除");

            const hideButtonEl = createButtonElement(
                "toggle-link",
                /* NO ENTRY */ "\u26D4",
                "非表示に設定/解除");

            linkView.appendChild(linkEl);
            linkView.appendChild(favButtonEl);
            linkView.appendChild(hideButtonEl);

            contentView.appendChild(linkView);
        }

        view.appendChild(nameView);
        view.appendChild(contentView);
    }

    function start() {
        categorys = (function () {
            function mapFn(categoryEl) {
                const links = [];
                for (let el = categoryEl.nextSibling; el; el = el.nextSibling) {
                    if (el.nodeName === "A") {
                        links.push(el);
                    } else if ((el.nodeName === "SCRIPT") ||
                               (el.nodeName === "B")) {
                        // end of category
                        break;
                    }
                }
                const name = categoryEl.textContent;

                return { name, links };
            }

            return Array.from(document.getElementsByTagName("b"), mapFn);
        })();

        categorys.forEach(i => categoryMap.set(i.name, i.links));

        // render menu
        const insertPoint = document.querySelector("body > font");

        {
            const view = createCategoryView("fav");
            view.addEventListener("click", favoriteButtonCb);
            view.id = "custom-menu-fav";
            document.body.insertBefore(view, insertPoint);
        }

        for (let [index, category] of categorys.entries()) {
            const view = createCategoryView(index);
            view.addEventListener("click", categoryButtonCb);
            view.id = `custom-menu-category-${index}`;
            document.body.insertBefore(view, insertPoint);
            renderCategory(view, category);
        }

        // init setting
        for (let name of settings.hiddenCategorys) {
            const view = getCategoryViewFromName(name);
            if (view) {
                view.classList.add("custom-menu-category-hide");
            }
        }

        settings.favorites.forEach(
            item => setLinkClass(item, "custom-menu-link-fav"));
        settings.hiddenLinks.forEach(
            item => setLinkClass(item, "custom-menu-link-hide"));

        // make sure favorite's link can clone metadata
        renderFavorite();

        // setting mode button
        const settingEl = document.createElement("div");
        settingEl.id = "custom-menu-setting";
        settingEl.innerHTML = "\u2699"; // GEAR
        settingEl.title = "メニューの編集/終了";
        settingEl.addEventListener("click", ev => {
            document.body.classList.toggle("custom-menu-customize");
            window.scrollTo(0, 0);
        }, false);
        document.body.insertBefore(settingEl, insertPoint);

        // display not managed node
        setTimeout(() => {
            document.querySelectorAll("b, br, font font").forEach(el => {
                el.parentElement.removeChild(el);
            });
            const el = document.querySelector("body > font");
            el.style.display = "unset";
        }, 0);
    }

    // bind settings
    settings.favorites.on("add", item => {
        settings.hiddenLinks.removeIf(i => linkIdEqual(i, item));

        console.log(TAG, `Add to favorite ${item}`);
        setLinkClass(item, "custom-menu-link-fav");
        renderFavorite();
    });
    settings.favorites.on("remove", item => {
        console.log(TAG, `Remove from favorite ${item}`);
        removeLinkClass(item, "custom-menu-link-fav");
        renderFavorite();
    });
    settings.favorites.on("clear", items => {
        console.log(TAG, `Remove ${items.length} items from favorite`);
        items.forEach(item => removeLinkClass(item, "custom-menu-link-fav"));
        renderFavorite();
    });

    settings.hiddenLinks.on("add", item => {
        settings.favorites.removeIf(i => linkIdEqual(i, item));

        console.log(TAG, `Hide link ${item}`);
        setLinkClass(item, "custom-menu-link-hide");
    });
    settings.hiddenLinks.on("remove", item => {
        console.log(TAG, `Unhide link ${item}`);
        removeLinkClass(item, "custom-menu-link-hide");
    });
    settings.hiddenLinks.on("clear", items => {
        console.log(TAG, `Unhide ${items.length} links`);
        items.forEach(item => removeLinkClass(item, "custom-menu-link-hide"));
    });

    settings.hiddenCategorys.on("add", item => {
        console.log(TAG, `Hide category ${item}`);
        const view = getCategoryViewFromName(item);
        if (view) {
            view.classList.add("custom-menu-category-hide");
        }
    });
    settings.hiddenCategorys.on("remove", item => {
        console.log(TAG, `Unhide category ${item}`);
        const view = getCategoryViewFromName(item);
        if (view) {
            view.classList.remove("custom-menu-category-hide");
        }
    });
    settings.hiddenCategorys.on("clear", items => {
        console.log(TAG, `Unhide ${items.length} categorys`);
        items.forEach(item =>  {
            const view = getCategoryViewFromName(item);
            if (view) {
                view.classList.remove("custom-menu-category-hide");
            }
        });
    });

    // main
    window.addEventListener("DOMContentLoaded", start, false);
})(window);

