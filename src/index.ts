import {TREBIS as App} from "./Application";
import {TrelloUI} from "./TrelloUI";

/**
 * Отслеживание изменений у элемента
 * @param callback
 * @param selector
 */
function trebisInitMutationObserver(callback: MutationCallback, selector: Element): MutationObserver {
    const observer = new MutationObserver(callback);
    observer.observe(selector, {
        childList: true,
        subtree: true
    });
    return observer
}

/**
 * Подготавливаем приложение для доски пользователя
 */
function trebisInitForUserBoard(app: App.Application): MutationObserver {
    app.createButtons();
    return trebisInitMutationObserver(app.createButtons.bind(app), document.querySelector(`.${TrelloUI.BOARD_HEADER}`));
}

/**
 * Подготавливаем приложение для отображения общей статистики
 */
function trebisInitForOrgBoards(app: App.Application): MutationObserver {
    app.createOrgButtons();
    return trebisInitMutationObserver(app.createOrgButtons.bind(app), document.getElementById(TrelloUI.HEADER_ID));
}

window.onload = () => {
    if (document.location.host === 'trello.com') {
        const app = new App.Application();
        let userObserver: MutationObserver = null;
        let orgObserver: MutationObserver = null;
        const run = () => {
            /**
             * Выполняется на личной карточке пользователя
             */
            if (document.querySelector('.board-name-input') && !document.getElementById(App.Application.SELECTOR)) {
                if (userObserver) {
                    userObserver.disconnect();
                    userObserver = null;
                }
                userObserver = trebisInitForUserBoard(app);
            }
            /**
             * Выполняется если есть шапка
             */
            if (document.getElementById(TrelloUI.HEADER_ID) && !document.getElementById(App.Application.ORG_SELECTOR)) {
                if (orgObserver) {
                    orgObserver.disconnect();
                    orgObserver = null;
                }
                orgObserver = trebisInitForOrgBoards(app);
            }
        };

        run();

        /**
         * Не понятно как отслеживать изменение url, поэтому просто отслеживаем изменения в title
         */
        const observer = new MutationObserver(run);
        observer.observe(document.querySelector('title'), {
            childList: true
        });
    }
};
