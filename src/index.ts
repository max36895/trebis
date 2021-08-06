import {TREBIS as App} from "./Application";
import {TrelloUI} from "./TrelloUI";

/**
 * Подготавливаем приложение для доски пользователя
 */
function trebisInitForUserBoard() {
    const app = new App.Application();
    app.createButtons();
    const observer = new MutationObserver(app.createButtons.bind(app));
    observer.observe(document.querySelector(`.${TrelloUI.BOARD_HEADER}`), {
        childList: true,
        subtree: true
    });
}

/**
 * Подготавливаем приложение для отображения общей статистики
 */
function trebisInitForOrgBoards() {
    const app = new App.Application();
    app.createOrgButtons();
    const observer = new MutationObserver(app.createOrgButtons.bind(app));
    observer.observe(document.getElementById(TrelloUI.HEADER_ID), {
        childList: true,
        subtree: true
    });
}

window.onload = () => {
    if (document.location.host === 'trello.com') {
        const run = () => {
            /**
             * Выполняется на личной карточке пользователя
             */
            if (document.querySelector('.board-name-input') && !document.getElementById(App.Application.SELECTOR)) {
                trebisInitForUserBoard();
            }
            /**
             * Выполняется если есть шапка
             */
            if (document.getElementById(TrelloUI.HEADER_ID) && !document.getElementById(App.Application.ORG_SELECTOR)) {
                trebisInitForOrgBoards();
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
