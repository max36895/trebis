import {Trebis} from "./Trebis";
import {ServerApi} from "./api/ServerApi";
import {TREBIS as utils} from "./utils";
import {TrelloUI} from "./TrelloUI";
import {
    ILocalStorage,
    IServerApiRequestRes,
    ITrebisStatistic,
    ITrebisStatisticText,
    ITrelloListData,
    ITrelloOrg,
    ITrelloUiCallback
} from "./interfaces";


export namespace TREBIS {
    /**
     * Само приложение, работающее с интерфейсом trello
     */
    export class Application {
        public static ORG_SELECTOR = 'trebis_org-buttons';
        public static SELECTOR = 'trebis_buttons';

        protected readonly STAT_DATE_WEEK = 'trebis_date_week';
        protected readonly STAT_DATE_MONTH = 'trebis_date_month';
        protected readonly STAT_DATE_OLD_MONTH = 'trebis_date_old-month';
        protected readonly STAT_DATE_ALL = 'trebis_date_all';
        protected readonly STAT_DATE_COMPARISON = 'trebis_date_comparison';

        protected readonly STAT_DATE_START = 'trebis_date-start';
        protected readonly STAT_DATE_END = 'trebis_date-end';
        protected readonly STAT_BTN = 'trebis_statistic_btn';
        protected readonly STAT_SERVER_LABEL = 'trebis_get-server-data';
        protected readonly STAT_CONTENT = 'trebis_statistic-content';

        private readonly ADMIN_USERS = ['maxim45387091', 'krasilnikow'];
        protected _trebis: Trebis;

        protected _trebisInit() {
            const trelloToken = this.getCookie('token');
            let localStorage: ILocalStorage = null;
            if (!trelloToken) {
                localStorage = this.getLocalStorage();
            }
            if (trelloToken || localStorage) {
                this._trebis = new Trebis();
                if (!trelloToken && localStorage) {
                    const key = localStorage.key;
                    const token = localStorage.token;
                    this._trebis.initKeyToken(key, token);
                } else {
                    this._trebis.trello.isSendForApi = false;
                    this._trebis.trello.trelloToken = trelloToken;
                }
                return true;
            } else {
                this._trebis = null;
            }
            return false;
        }

        public getLocalStorage(): ILocalStorage {
            if (localStorage.trebis_key && localStorage.trebis_token) {
                return {
                    key: localStorage.trebis_key,
                    token: localStorage.trebis_token
                };
            }
            return null;
        }

        public setLocalStorage(storage: ILocalStorage) {
            localStorage.setItem('trebis_key', storage.key);
            localStorage.setItem('trebis_token', storage.token);
        }

        public getCookie(name: string): string {
            const matches = document.cookie.match(
                new RegExp("(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
            return matches ? decodeURIComponent(matches[1]) : undefined;
        }

        public getShortLink(): string {
            return document.location.pathname;
        }

        /**
         * Запуск обработчика, создания пустого списка
         * @param e
         */
        public addListHandler(e: Event): void {
            e.preventDefault();
            const callback = async () => {
                const addCallback = async (e: Event) => {
                    e.preventDefault();
                    await this._trebis.getBoardId(this.getShortLink());
                    const listName: HTMLInputElement = document.querySelector(`.${TrelloUI.INPUT_LIST_NAME}`);
                    const name = listName.value || utils.date();
                    this._trebis.createList(name).then(res => {
                        if (res) {
                            TrelloUI.successNotification(`Список ${name} успешно создан`);
                        } else {
                            TrelloUI.errorNotification(`Не удалось создать список ${name}`);
                        }
                    });
                };
                TrelloUI.openCreateListDialog(utils.date(), addCallback.bind(this));
            };
            this._getTrebisQuery(callback);
        }

        /**
         * Запуск обработчика, который создает список и копирует карточки
         * @param e
         */
        public runScriptHandler(e: Event): void {
            e.preventDefault();
            const callback = async () => {
                TrelloUI.showIndicator();
                await this._trebis.getBoardId(this.getShortLink());
                // Добавляем список
                const lists: ITrelloListData[] = await this._trebis.getLists();
                const name = utils.date();
                const thisListId = await this._trebis.getListId(lists, name);
                if (thisListId === null) {
                    await this._trebis.createList();
                } else {
                    this._trebis.thisListId = thisListId;
                }

                if (this._trebis.thisListId && this._trebis.thisListId.id) {
                    await this._trebis.initLabels();
                    // Обновляем карточки
                    const count = await this._trebis.updateCard(lists);
                    if (count !== null) {
                        TrelloUI.successNotification(`Список ${name} успешно создан. Перенесено карточек: ${count}`);
                    }
                } else {
                    TrelloUI.errorNotification(`Не удалось создать список ${name}`);
                }
                TrelloUI.hideIndicator();
            };
            this._getTrebisQuery(callback);
        }

        /**
         * Нажата кнопка настроек.
         * По факту этой кнопки быть не должно, но если она есть, значит не удалось получить токе из cookie
         * Поэтому даем пользователю возможность ввести ключ и токен вручную
         * @param e
         */
        public settingHandler(e: Event) {
            e.preventDefault();
            this.openSettingModal();
        }

        /**
         * Запуск обработчика для удаления старых списков
         * @param e
         */
        public removeHandler(e: Event) {
            e.preventDefault();

            if (confirm('Уверены что хотите удалить старые списки, останутся первые 30?')) {
                if (confirm('На все 100% уверены?')) {
                    const callback = async () => {
                        await this._trebis.getBoardId(this.getShortLink());
                        let lists: ITrelloListData[] = await this._trebis.trello.getLists(this._trebis.boardId);
                        const count = await this._trebis.removeOldLists(lists);
                        TrelloUI.successNotification(`Было удалено списков: ${count}`);
                        lists = null;
                    };
                    this._getTrebisQuery(callback)
                }
            }
        }

        /**
         * Обработка нажатия кнопки для получения статистики пользователя по доске
         * @param event
         * @param isFull
         */
        public statisticHandler(event: MouseEvent, isFull: boolean = false) {
            event.preventDefault();
            TrelloUI.openModal(this._getStatisticContentTemplate(isFull), `Получение статистики${isFull ? ' по всем участникам' : ''}`);
            this._getStatistic(isFull);
        }

        /**
         * Обработка нажатия кнопки для получения статистики по всем пользователям
         * @param event
         */
        public statisticOrgHandler(event: MouseEvent) {
            this.statisticHandler(event, true);
            const serverData: HTMLElement = document.querySelector(`.${this.STAT_SERVER_LABEL}`);
            if (serverData) {
                serverData.onclick = async (e: MouseEvent) => {
                    e.preventDefault();
                    if (e.target) {
                        const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                        // @ts-ignore
                        statisticContent.innerHTML = await this._getStatisticFromServer(e.target.innerText);
                    }
                }
            }
        }

        public openSettingModal() {
            let key = '';
            let token = '';
            const localStorage = this.getLocalStorage();
            if (localStorage) {
                key = localStorage.key;
                token = localStorage.token;
            }

            const content: string = '<div class="window-main-col" style="margin:12px 40px 8px 56px;">' +
                '<span>Узнать ключ и токен:<a href="https://trello.com/app-key" target="_blank">тут</a></span>' +
                '<form action="#" id="trebis-data"><div>' +
                '<label for="trebis-key">key</label>' +
                `<input type="text" id="trebis-key" style="width:100%" value="${key}">` +
                '</div><div>' +
                '<label for="trebis-token">token</label>' +
                `<input type="text" id="trebis-token" style="width:100%"  value="${token}">` +
                '</div><div>' +
                '<button class="nch-button--primary">Сохранить</button>' +
                '</div></form></div>';
            TrelloUI.openModal(content, 'Настройки');

            const trebisData: HTMLElement = document.getElementById('trebis-data');
            trebisData.onsubmit = e => {
                e.stopPropagation();
                const keyElement: HTMLInputElement = document.getElementById('trebis-key') as HTMLInputElement;
                const tokenElement: HTMLInputElement = document.getElementById('trebis-token') as HTMLInputElement;
                const data: ILocalStorage = {
                    key: keyElement.value,
                    token: tokenElement.value
                };
                this.setLocalStorage(data);
                TrelloUI.closeModal();
            }
        }

        protected _getStatisticResultTemplate(statInfo: ITrebisStatisticText, title?: string): string {
            const style = (color: string): string => {
                return `border-bottom:3px solid ${color};border-radius:4px;width:20%;`;
            };
            return `<tr><td>${title || ''}</td>` +
                `<td style="${style('red')}">${statInfo.red}</td>` +
                `<td style="${style('yellow')}">${statInfo.yellow}</td>` +
                `<td style="${style('green')}">${statInfo.green}</td>` +
                `<td style="${style('blue')}">${statInfo.blue}</td>` +
                '<tr>';
        }

        protected _getStatisticContentTemplate(isFull: boolean = false): string {
            const oldDate = Date.now() - utils.getDayInSec(7);
            const dateStart = utils.date(oldDate, true);
            const dateEnd = utils.date(null, true);

            const styleLink = 'margin-left:10px;border-bottom:1px dashed blue;cursor:pointer';

            const month = (new Date()).getMonth();

            const thisMonth = this._getMonthText(month);
            const oldMonth = this._getMonthText(month - 1);
            let res = '<div class="window-main-col" style="margin:12px 40px 8px 56px;width:calc(100% - 100px)"><div style="display:flex">' +
                `<div style="flex-grow:1"><label for="${this.STAT_DATE_START}">с</label>` +
                `<input type="date" id="${this.STAT_DATE_START}" style="width: 100%" value="${utils.revertDate(dateStart)}"></div>` +
                `<div style="margin-left:15px;flex-grow:1"><label for="${this.STAT_DATE_END}">по</label>` +
                `<input type="date" id="${this.STAT_DATE_END}" style="width: 100%" value="${utils.revertDate(dateEnd)}"></div>` +
                '<div style="text-align:right">' +
                `<p id="${this.STAT_DATE_WEEK}" style="${styleLink}">Последние 7 дней</p>` +
                `<p id="${this.STAT_DATE_MONTH}" style="${styleLink}">За ${thisMonth}</p>` +
                `<p id="${this.STAT_DATE_OLD_MONTH}" style="${styleLink}">За ${oldMonth}</p>` +
                `<p id="${this.STAT_DATE_ALL}" style="${styleLink}">За все время</p>` +
                `<p id="${this.STAT_DATE_COMPARISON}" style="${styleLink}">Сравнить ${thisMonth} и ${oldMonth}</p>` +
                '</div></div>' +
                `<div><button class="nch-button--primary ${this.STAT_BTN}">Получить</button></div>`;

            if (isFull) {
                const year = (new Date()).getFullYear();
                res += `<div style="display:flex;float:left" class="${this.STAT_SERVER_LABEL}">`;
                for (let i = year; i >= 2020; i--) {
                    res += `<p style="${styleLink}">${i}</p>`;
                }
                res += '</div>';
            }

            res += `<div class="${this.STAT_CONTENT}" style="margin:30px 0;"></div></div>`;
            return res;
        }

        protected _getStatisticServerResultTemplate(serverData: IServerApiRequestRes, year: string): string {
            let res = '';
            const serverDatas = serverData.data;

            for (const boardName in serverDatas) {
                if (serverDatas.hasOwnProperty(boardName)) {
                    res += `<div><h3>Информация о доске: <u>${boardName}</u></h3><table>`;
                    for (const month in serverDatas[boardName]) {
                        if (serverDatas[boardName].hasOwnProperty(month)) {
                            const data = serverDatas[boardName][month];
                            res += this._getStatisticResultTemplate(data, this._getMonthText(Number(month)));
                        }
                    }
                    res += `<tr><td colspan="5">Итог за ${year}</td></tr>`;
                    res += this._getStatisticResultTemplate(serverData.total[boardName]);
                    res += '</table></div>';
                }
            }

            if (!res) {
                res = '<p style="color:red">На сервере нет сохраненных данных!</p>';
            }
            return `<div>${res}</div>`;
        }

        protected _getMonthText(month: number) {
            if (month < 0) {
                month = 12 + month;
            } else if (month > 11) {
                month %= 12;
            }
            switch (month) {
                case 0:
                    return 'Январь';
                case 1:
                    return 'Февраль';
                case 2:
                    return 'Март';
                case 3:
                    return 'Апрель';
                case 4:
                    return 'Май';
                case 5:
                    return 'Июнь';
                case 6:
                    return 'Июль';
                case 7:
                    return 'Август';
                case 8:
                    return 'Сентябрь';
                case 9:
                    return 'Октябрь';
                case 10:
                    return 'Ноябрь';
                case 11:
                    return 'Декабрь';
            }
            return '';
        }

        private _saveStatistic(contentHtml: HTMLElement) {
            const saveStat = 'trebis_save_statistic';
            const body = contentHtml.innerHTML;
            contentHtml.innerHTML += TrelloUI.getButton('Скачать', saveStat);
            const saveBtn: HTMLElement = document.querySelector(`.${saveStat}`);
            if (saveBtn) {
                saveBtn.onclick = e => {
                    e.preventDefault();
                    const content = `<!DOCTYPE><html><head></head><body>${body}</body></html>`;
                    utils.downloadAsFile('statistic.html', content, {type: 'text/html'})
                };
            }
        }

        private async _getStatisticResult(dateStart: string, dateEnd: string) {
            const callback = async () => {
                TrelloUI.showIndicator();
                await this._trebis.getBoardId(this.getShortLink());
                TrelloUI.successNotification('Получение статистики');
                const statInfo = await this._trebis.getStatistic(dateStart, dateEnd);
                const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                if (statInfo) {
                    statisticContent.innerHTML =
                        `<h4>Информация с ${dateStart} по ${dateEnd}</h4><table>${this._getStatisticResultTemplate(statInfo, 'Итог:')}</table>`;
                    this._saveStatistic(statisticContent);
                } else {
                    statisticContent.innerHTML = '<p style="color:red">Произошла ошибка при получении доски</p>';
                }
                TrelloUI.hideIndicator();
            };
            await this._getTrebisQuery(callback);
        }

        private async _getStatisticFullResult(dateStart: string, dateEnd: string) {
            const callback = async () => {
                TrelloUI.showIndicator();
                const orgBoards: ITrelloOrg = await this._trebis.trello.getOrganizations(Trebis.ORG_NAME);
                const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                if (orgBoards && orgBoards.boards) {
                    statisticContent.innerHTML = `<h4>Информация с ${dateStart} по ${dateEnd}</h4>`;
                    for (const board of orgBoards.boards) {
                        this._trebis.boardId = board.id;
                        TrelloUI.successNotification(`Получение статистики по доске: ${board.name}`);
                        const statInfo = await this._trebis.getStatistic(dateStart, dateEnd,
                            {
                                boardName: board.name,
                                isSaveOnServer: true
                            });
                        if (statInfo) {
                            statisticContent.innerHTML += '<div style="margin:15px 0;">' +
                                `<h3>Информация по доске: <u>${board.name}</u></h3>` +
                                `<table>${this._getStatisticResultTemplate(statInfo, 'Итог:')}</table></div>`;
                        } else {
                            statisticContent.innerHTML += `<p style="color:red">Произошла ошибка при получении доски <u>${board.name}</u></p>`;
                        }
                    }
                    this._saveStatistic(statisticContent);
                    TrelloUI.successNotification(`Статистика с ${dateStart} по ${dateEnd} получена`);
                } else {
                    statisticContent.innerHTML = '<span style="color:red">Произошла ошибка при получении информации о доске</span>';
                }
                TrelloUI.hideIndicator();
            };
            await this._getTrebisQuery(callback);
        }

        private async _getTrebisQuery(callback: Function): Promise<void> {
            if (!this._trebis) {
                this._trebisInit();
            }
            if (this._trebis) {
                return callback();
            } else {
                this.openSettingModal();
            }
        }

        protected _comparisonEqual(old: ITrebisStatistic, current: ITrebisStatistic): ITrebisStatisticText {
            const el = (value: number, color: string, title: string) => {
                return `<span style="color:${color}" title="${title}">${value}</span>`;
            };
            let red;
            let yellow;
            let green;
            let blue;
            if (old.red < current.red) {
                red = el(current.red - old.red, 'red', 'Плохо! Не сделанных задач стало больше');
            } else {
                red = el(old.red - current.red, 'green', 'Супер! Не сделанных задач стало меньше');
            }
            if (old.yellow < current.yellow) {
                yellow = el(current.yellow - old.yellow, 'red', 'Плохо! Перенесенных задач стало больше');
            } else {
                yellow = el(old.yellow - current.yellow, 'green', 'Good! Перенесенных задач стало меньше');
            }
            if (old.green < current.green) {
                green = el(current.green - old.green, 'green', 'Хорошо! Выполненных задач стало больше');
            } else {
                green = el(old.green - current.green, 'red', 'Плохо! Выполненных задач стало меньше');
            }
            if (old.blue < current.blue) {
                blue = el(current.blue - old.blue, 'green', 'Отлично! Выполненных вне плана задач стало больше');
            } else {
                blue = el(old.blue - current.blue, 'red', 'Могло быть и лучше');
            }
            return {
                red,
                yellow,
                green,
                blue
            };
        }

        private async _getComparisonResult(isFull: boolean) {
            const callback = async () => {
                const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                const comparisonCallback = async () => {
                    const thisDate = utils.getThisMonth();
                    const statInfo = await this._trebis.getStatistic(thisDate.start, thisDate.end);
                    const oldDate = utils.getOldMonth();
                    const statInfoOld = await this._trebis.getStatistic(oldDate.start, oldDate.end);
                    if (statInfo && statInfoOld) {
                        const month = (new Date()).getMonth();
                        statisticContent.innerHTML += '<table>' +
                            this._getStatisticResultTemplate(statInfo, this._getMonthText(month)) +
                            this._getStatisticResultTemplate(statInfoOld, this._getMonthText(month - 1)) +
                            this._getStatisticResultTemplate(this._comparisonEqual(statInfoOld, statInfo), 'Итог') +
                            '</table>';
                    } else {
                        statisticContent.innerHTML += '<p style="color:red">Произошла ошибка при получении доски</p>';
                    }
                };
                statisticContent.innerHTML = '';
                TrelloUI.showIndicator();
                if (isFull) {
                    const orgBoards: ITrelloOrg = await this._trebis.trello.getOrganizations(Trebis.ORG_NAME);
                    if (orgBoards && orgBoards.boards) {
                        for (const board of orgBoards.boards) {
                            this._trebis.boardId = board.id;
                            statisticContent.innerHTML += `<h3>Информация по доске: <u>${board.name}</u></h3>`;
                            TrelloUI.successNotification(`Получение информации по доске: ${board.name}`);
                            await comparisonCallback();
                        }
                    }
                } else {
                    await this._trebis.getBoardId(this.getShortLink());
                    TrelloUI.successNotification('Получение информации');
                    await comparisonCallback();
                }
                TrelloUI.hideIndicator();
            };
            await this._getTrebisQuery(callback);
        }

        protected async _getStatisticFromServer(year: string): Promise<string> {
            const serverApi = new ServerApi();
            const statData = await serverApi.get(year);
            if (statData.status) {
                return this._getStatisticServerResultTemplate(statData.res, year);
            } else {
                return '<p style="color:red">Не удалось получить данные с сервера</p>';
            }
        }

        protected _getStatistic(isFull: boolean): void {
            let statisticCallback = this._getStatisticResult.bind(this);
            if (isFull) {
                statisticCallback = this._getStatisticFullResult.bind(this);
            }

            const weekBtn: HTMLElement = document.getElementById(this.STAT_DATE_WEEK);
            weekBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                const startTime = Date.now() - utils.getDayInSec(7);
                await statisticCallback(utils.date(startTime), utils.date());
            };
            const monthBtn: HTMLElement = document.getElementById(this.STAT_DATE_MONTH);
            monthBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                const dateRange = utils.getThisMonth();
                await statisticCallback(dateRange.start, dateRange.end);
            };
            const oldMonthBtn: HTMLElement = document.getElementById(this.STAT_DATE_OLD_MONTH);
            oldMonthBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                const dateRange = utils.getOldMonth();
                await statisticCallback(dateRange.start, dateRange.end);
            };
            const allBtn: HTMLElement = document.getElementById(this.STAT_DATE_ALL);
            allBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                await statisticCallback('01.01.2020', utils.date());
            };
            const comparisonBtn: HTMLElement = document.getElementById(this.STAT_DATE_COMPARISON);
            comparisonBtn.onclick = async (e: MouseEvent) => {
                e.preventDefault();
                await this._getComparisonResult(isFull);
            };

            const trebisStatRes: HTMLElement = document.querySelector(`.${this.STAT_BTN}`);
            trebisStatRes.onclick = async (e: MouseEvent) => {
                e.preventDefault();

                const dateStart: HTMLInputElement = document.getElementById(this.STAT_DATE_START) as HTMLInputElement;
                const dateEnd: HTMLInputElement = document.getElementById(this.STAT_DATE_END) as HTMLInputElement;

                const startValue = utils.revertDate(dateStart.value, false);
                const endValue = utils.revertDate(dateEnd.value, false);
                await statisticCallback(startValue, endValue);
            }
        }

        public createButtons() {
            if (!document.getElementById(Application.SELECTOR)) {
                const prefix = 'trebis_button_';
                const addListName = `${prefix}add-list`;
                const runScriptName = `${prefix}run-script`;
                const settingName = `${prefix}setting`;
                const statisticName = `${prefix}statistic`;
                const trashName = `${prefix}trash`;
                const isTrebisToken = !!this.getCookie('token');
                let innerHtml = TrelloUI.getHeaderButton({
                    id: addListName,
                    title: 'Нажмите для создания пустого списка',
                    label: 'Создать пустой список',
                    icon: 'add'
                });
                innerHtml += TrelloUI.getHeaderButton({
                    id: runScriptName,
                    title: 'Нажмите для переноса задач',
                    label: 'Запуск скрипта',
                    icon: 'card'
                });
                if (!isTrebisToken) {
                    innerHtml += TrelloUI.getHeaderButton({
                        id: settingName,
                        title: 'Нажмите для открытия настроек',
                        label: 'Открытие настроек',
                        icon: 'gear'
                    });
                }
                const memberMenu: HTMLElement = document.querySelector('.js-open-header-member-menu');
                let isShowDropButton = false;
                if (memberMenu) {
                    const userName = (memberMenu.title.match(/\(([^\)]+)\)/gi))[0]?.replace(/\(|\)/gi, '');
                    if (this.ADMIN_USERS.includes(userName)) {
                        isShowDropButton = true;
                        innerHtml += TrelloUI.getHeaderButton({
                            id: trashName,
                            title: 'Нажмите для удаления старых списков',
                            label: 'Удаление старых списков',
                            icon: 'trash'
                        });
                    }
                }
                innerHtml += TrelloUI.getHeaderButton({
                    id: statisticName,
                    title: 'Нажмите для получения статистики',
                    label: 'Получение статистики',
                    icon: 'information'
                });
                const buttons = document.createElement('div');
                buttons.id = Application.SELECTOR;
                buttons.innerHTML = innerHtml;

                const callbacks: ITrelloUiCallback[] = [];
                callbacks.push({id: addListName, callback: this.addListHandler.bind(this)});
                callbacks.push({id: runScriptName, callback: this.runScriptHandler.bind(this)});
                if (isShowDropButton) {
                    callbacks.push({id: trashName, callback: this.removeHandler.bind(this)});
                }
                callbacks.push({id: statisticName, callback: this.statisticHandler.bind(this)});
                if (!isTrebisToken) {
                    callbacks.push({id: settingName, callback: this.settingHandler.bind(this)})
                }

                TrelloUI.addInBoardHeader(buttons, callbacks);
            }
        }

        public createOrgButtons() {
            if (!document.getElementById(Application.ORG_SELECTOR)) {
                const prefix = 'trebis_button_';
                const statisticName = `${prefix}org-statistic`;
                const settingName = `${prefix}org-setting`;
                const isTrebisToken = !!this.getCookie('token');
                let innerHtml = TrelloUI.getHeaderButton({
                    id: statisticName,
                    title: 'Нажмите для получения статистики по всем участникам',
                    label: 'Получение общей статистики',
                    icon: 'information'
                });
                if (!isTrebisToken) {
                    innerHtml += TrelloUI.getHeaderButton({
                        id: settingName,
                        title: 'Нажмите для открытия настроек',
                        label: 'Открытие настроек',
                        icon: 'gear'
                    });
                }
                const buttons = document.createElement('div');
                buttons.id = Application.ORG_SELECTOR;
                buttons.innerHTML = innerHtml;
                const callbacks: ITrelloUiCallback[] = [
                    {
                        id: statisticName,
                        callback: this.statisticOrgHandler.bind(this)
                    }
                ];
                if (!isTrebisToken) {
                    callbacks.push({
                        id: settingName,
                        callback: this.settingHandler.bind(this)
                    })
                }
                TrelloUI.addInHeader(buttons, callbacks)
            }
        }
    }
}

