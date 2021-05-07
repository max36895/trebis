import {TREBIS as App} from "./Application";
import {Trebis} from "./Trebis";

/**
 * Подготавливаем приложение для доски пользователя
 */
function trebisInitForUserBoard() {
    const app = new App.Application();
    app.createButtons();
    const observer = new MutationObserver(app.createButtons.bind(app));
    observer.observe(document.querySelector('.board-header'), {
        childList: true,
        subtree: true
    });
}

/**
 * Подготавливаем приложение для отображения общей статистики
 * Запускается на странице basecontrol
 */
function trebisInitForOrgBoards() {
    const app = new App.Application();
    app.createOrgButtons();
    const observer = new MutationObserver(app.createOrgButtons.bind(app));
    observer.observe(document.querySelector('#header'), {
        childList: true,
        subtree: true
    });
}

window.onload = () => {
    /**
     * Ждем пока страница полностью загрузится.
     * При этом проверяем что есть имя доски
     */
    if (document.location.host === 'trello.com') {
        const run = () => {
            /**
             * Выполняется на личной карточке пользователя
             */
            if (document.querySelector('.board-name-input')) {
                if (!document.getElementById(App.Application.SELECTOR)) {
                    trebisInitForUserBoard();
                }
            }
            /**
             * Выполняется на разводящей карточке
             */
            if (document.location.pathname.includes(Trebis.ORG_NAME)) {
                if (!document.getElementById(App.Application.ORG_SELECTOR)) {
                    trebisInitForOrgBoards();
                }
            }
        }

        run();

        /**
         * Не понятно как отслеживать изменение url, поэтому просто отслеживаем изменения в title
         */
        const observer = new MutationObserver(run);
        observer.observe(document.querySelector('title'), {
            childList: true
        });
    }
}
