import {ITrelloUIButton, ITrelloUiCallback} from "./interfaces";

export class TrelloUI {
    public static INPUT_LIST_NAME = 'trebis_new-listName';
    public static HEADER_ID = 'header';
    public static BOARD_HEADER = 'board-header';

    public static getHeaderButton(options: ITrelloUIButton): string {
        const {id, title = 'title', label = 'label', icon} = options;
        return `<a class="board-header-btn" href="#" id="${id}" title="${title}" aria-label="${label}" style="border-bottom:#fff solid 2px;box-sizing:border-box"><span class="icon-sm icon-${icon} board-header-btn-icon"></span></a>`;
    }

    public static getButton(title: string, className: string = '', style: string = ''): string {
        return `<input class="nch-button nch-button--primary mod-list-add-button ${className}" style="${style}" type="submit" value="${title}">`;
    }

    protected static addHeaderEl(selector: string, element: HTMLElement,
                                 callbacks?: ITrelloUiCallback[], isId: boolean = false): boolean {
        let boardHeader: HTMLElement;
        if (isId) {
            boardHeader = document.getElementById(selector);
        } else {
            boardHeader = document.querySelector(selector);
        }
        if (boardHeader) {
            boardHeader.prepend(element);
            if (callbacks) {
                callbacks.forEach((callback) => {
                    const el: HTMLElement = (callback.id ? document.getElementById(callback.id) :
                        document.querySelector(`.${callback.class}`));
                    if (el) {
                        el.onclick = callback.callback
                    }
                });
            }
            return true;
        }
        return false;
    }

    public static addInHeader(element: HTMLElement, callbacks?: ITrelloUiCallback[]): boolean {
        return this.addHeaderEl(TrelloUI.HEADER_ID, element, callbacks, true);
    }

    public static addInBoardHeader(element: HTMLElement, callbacks?: ITrelloUiCallback[]): boolean {
        return this.addHeaderEl(`.${TrelloUI.BOARD_HEADER}`, element, callbacks);
    }

    public static openCreateListDialog(value: string, addCallback?: Function, closeCallback?: Function): boolean {
        const board = document.getElementById('board');
        if (board) {
            const listNameBtn = 'trebis_new-listName-add';
            const myCard = document.createElement('div');
            myCard.id = 'trebis_add_newList';
            myCard.style.position = 'absolute';
            myCard.style.width = '100%';
            myCard.style.height = '100%';
            myCard.style.zIndex = '2';
            myCard.innerHTML = '<div style="width:100%;height:100%;background:black;opacity:0.5" class="trebis_close_newList"></div>' +
                '<div style="position:absolute;top:0" class="js-add-list  list-wrapper mod-add"><form>' +
                `<input class="list-name-input ${this.INPUT_LIST_NAME}" value="${value}" type="text" name="name" placeholder="Ввести заголовок списка" autocomplete="off" dir="auto" maxlength="512">` +
                '<div class="list-add-controls u-clearfix">' +
                TrelloUI.getButton('Добавить список', `mod-list-add-button ${listNameBtn}`) +
                '<a class="icon-lg icon-close dark-hover trebis_close_newList_btn" href="#" aria-label="Отменить редактирование"></a>' +
                '</div></form></div>';
            board.prepend(myCard);
            const close = (e: Event) => {
                e.preventDefault();
                const newList = document.getElementById(myCard.id);
                if (closeCallback) {
                    closeCallback(e);
                }
                if (newList) {
                    board.removeChild(newList);
                }
            };

            const closeList: HTMLElement = document.querySelector('.trebis_close_newList');
            const closeListBtn: HTMLElement = document.querySelector('.trebis_close_newList_btn');
            if (closeList) {
                closeList.onclick = close;
            }
            if (closeListBtn) {
                closeListBtn.onclick = close;
            }

            const addListBtn: HTMLElement = document.querySelector(`.${listNameBtn}`);
            if (addListBtn) {
                addListBtn.onclick = async (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (addCallback) {
                        await addCallback(e);
                    }
                    close(e);
                }
            }
            return true;
        }
        return false;
    }

    public static openModal(content: string, title?: string) {
        document.querySelector('body').classList.add('window-up');
        const trelloWindow: HTMLElement = document.querySelector('.window');
        if (trelloWindow) {
            trelloWindow.style.display = 'block';
            const windowWrapper = document.querySelector('.window-wrapper');
            windowWrapper.innerHTML = '<a class="icon-md icon-close dialog-close-button" href="#"></a>';
            const windowContent = document.createElement('div');
            windowContent.classList.add('card-detail-window', 'u-clearfix');
            windowContent.style.minHeight = 'auto';
            windowContent.innerHTML = '';
            if (title) {
                windowContent.innerHTML = '<div class="window-header"><div class="window-title">' +
                    `<h2 class="card-detail-title" dir="auto">${title}</h2></div></div>`;
            }
            windowContent.innerHTML += content;
            windowWrapper.append(windowContent);

            const dialogCloseButton: HTMLElement = document.querySelector('.dialog-close-button');
            if (dialogCloseButton) {
                dialogCloseButton.onclick = this.closeModal;
            }
            const windowOverlay: HTMLElement = document.querySelector('.window-overlay');
            if (windowOverlay) {
                windowOverlay.onclick = (e: Event) => {
                    if (e.target === windowOverlay) {
                        this.closeModal();
                    }
                }
            }
        }
    }

    public static closeModal() {
        document.querySelector('body').classList.remove('window-up');
        const trelloWindow: HTMLElement = document.querySelector('.window');
        if (trelloWindow) {
            const windowWrapper = document.querySelector('.window-wrapper');
            if (windowWrapper) {
                windowWrapper.innerHTML = '';
            }
            trelloWindow.style.display = 'none';
        }
    }

    protected static readonly TREBIS_INDICATOR = 'trebis_loading_wrapper';
    protected static indicatorTimeOut: NodeJS.Timeout = null;

    public static showIndicator() {
        let loadingWrapper = document.getElementById(this.TREBIS_INDICATOR);
        if (!loadingWrapper) {
            loadingWrapper = document.createElement('div');
            loadingWrapper.id = this.TREBIS_INDICATOR;
            loadingWrapper.innerHTML = '<div class="trebis_loading"></div>';
            const body = document.querySelector('body');
            body.prepend(loadingWrapper);
            const style = document.createElement('style');
            style.innerHTML = `#${this.TREBIS_INDICATOR}{position:fixed;width:100%;height:100%;display:none;justify-content:center;align-items:center;z-index:20}#${this.TREBIS_INDICATOR}:after{content:'';width:100%;height:100%;background:black;opacity:0.1;top:0;left:0;position:absolute;}#${this.TREBIS_INDICATOR}.trebis_open{display:flex;}`
                + '.trebis_loading{width:40px;height:40px;border:2px dashed blue;border-right-color:red;border-bottom-color:yellow;border-left-color:green;border-radius:50%;animation:trebis_loading 1.3s infinite linear;}' +
                '@keyframes trebis_loading{0%{transform:rotate3d(0,0,0,0deg);}100%{transform:rotate3d(1,1,1.8,360deg);}}';
            body.prepend(style);
        }
        loadingWrapper.classList.add('trebis_open');
        // На случай если вдруг все крашнется. Тогда индикатор сам скроется
        this.indicatorTimeOut = setTimeout(() => {
            this.hideIndicator();
        }, 60000)
    }

    public static hideIndicator() {
        const loadingWrapper = document.getElementById(this.TREBIS_INDICATOR);
        if (loadingWrapper) {
            loadingWrapper.classList.remove('trebis_open');
            clearTimeout(this.indicatorTimeOut);
        }
    }

    public static addNotification(msg: string, style: string) {
        const notId = 'trebis_notification';
        let notification = document.getElementById(notId);
        if (!notification) {
            notification = document.createElement('div');
            notification.id = notId;
            const body = document.querySelector('body');
            body.prepend(notification);
            const style = document.createElement('style');
            style.innerHTML = `#${notId}{position:fixed;bottom:10px;right:10px;z-index:22}` +
                '.trebis_notification_card{margin-bottom:3px;padding:2px 5px;width:300px;height:40px;border-radius:4px;display:flex;justify-content:center;align-items:center;color:white;transition:all 2s ease; opacity:1;overflow:hidden;}' +
                /*'.trebis_notification_color-green{background:#61bd4f;}' +
                '.trebis_notification_color-red{background:#eb5a46;}' +*/
                '.trebis_notification_close{opacity:0}';
            body.prepend(style);
        }
        const notCard = document.createElement('div');
        notCard.classList.add('trebis_notification_card', `card-label-${style}`);
        notCard.title = msg;
        notCard.innerText = msg;
        notification.prepend(notCard);
        setTimeout(() => {
            notCard.classList.add('trebis_notification_close');
            setTimeout(() => {
                notification.removeChild(notCard);
            }, 900);
        }, 4000);
    }

    public static successNotification(msg: string) {
        this.addNotification(msg, 'green');
    }

    public static errorNotification(msg: string) {
        this.addNotification(`Ошибка:${msg}`, 'red');
    }
}
