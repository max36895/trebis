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

/**
 * На всякий случай, чтобы не было конфликтов
 */
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

        private readonly ADMIN_USERS = ['maxim45387091', 'noname924'];
        protected _trebis: Trebis;

        public constructor() {
            this._trebisInit();
        }

        protected _trebisInit(): boolean {
            const trelloToken = this._getCookie('token');
            if (trelloToken) {
                this._trebis = new Trebis();
                this._trebis.trello.isSendForApi = false;
                this._trebis.trello.trelloToken = trelloToken;
                return true;
            }

            const localStorage: ILocalStorage = this._getLocalStorage();
            if (localStorage) {
                this._trebis = new Trebis();
                const key = localStorage.key;
                const token = localStorage.token;
                this._trebis.initKeyToken(key, token);
                return true;
            }
            this._trebis = null;
            return false;
        }

        protected _getLocalStorage(): ILocalStorage {
            const key = utils.getLocalStorage('key');
            const token = utils.getLocalStorage('token');
            if (key && token) {
                return {key, token};
            }
            return null;
        }

        protected _setLocalStorage(storage: ILocalStorage): void {
            utils.setLocalStorage('key', storage.key);
            utils.setLocalStorage('token', storage.token);
        }

        protected _getCookie(name: string): string {
            const matches = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
            return matches ? decodeURIComponent(matches[1]) : undefined;
        }

        protected async _getBoardId(): Promise<string> {
            return await this._trebis.getBoardId(document.location.pathname);
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
                    await this._getBoardId();
                    const listName: HTMLInputElement = document.querySelector(`.${TrelloUI.INPUT_LIST_NAME}`);
                    const name = listName.value || utils.date();
                    this._trebis.createList(name).then(res => {
                        if (res) {
                            TrelloUI.successNotification(`Список ${name} создан`);
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
                await this._getBoardId();
                // Добавляем список если его нет
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
                        TrelloUI.successNotification(`Список ${name} создан. Перенесено ${count} карточек`);
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

            if (confirm('Уверены что хотите удалить старые списки? Останутся первые 30')) {
                if (confirm('На все 100% уверены?')) {
                    const callback = async () => {
                        await this._getBoardId();
                        let lists: ITrelloListData[] = await this._trebis.trello.getLists(this._trebis.boardId);
                        const count = await this._trebis.removeOldLists(lists);
                        TrelloUI.successNotification(`Удалено ${count} списков`);
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
            TrelloUI.openModal(this._getStatisticContentTemplate(isFull), `Получение${isFull ? ' общей' : ''} статистики`);
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
                        statisticContent.innerHTML = await this._getStatisticFromServer((e.target as HTMLElement).innerText);
                    }
                }
            }
        }

        public async openSettingModal(isShowAuth: boolean = true): Promise<void> {
            const isTrebisToken = !!this._getCookie('token');
            // Если не удалось получить токен, то предлагаем авторизоваться вручную
            if (!isTrebisToken && isShowAuth) {
                let key = '';
                let token = '';
                const localStorage = this._getLocalStorage();
                if (localStorage) {
                    key = localStorage.key;
                    token = localStorage.token;
                }
                const tKey = 'trebis_key';
                const tToken = 'trebis_token';

                const content: string = '<div class="window-main-col" style="margin:12px 40px 8px 56px;">' +
                    `${localStorage ? '<a href="#" id="trebis_getOrdId">Выбрать организацию по умолчанию</a>' : ''}` +
                    '<span>Узнать ключ и токен: <a href="https://trello.com/app-key" target="_blank">тут</a></span>' +
                    '<form action="#" id="trebis_data"><div>' +
                    `<label for="${tKey}">key</label>` +
                    `<input type="text" id="${tKey}" style="width:100%" value="${key}">` +
                    '</div><div>' +
                    `<label for="${tToken}">token</label>` +
                    `<input type="text" id="${tToken}" style="width:100%"  value="${token}">` +
                    '</div><div>' +
                    TrelloUI.getButton('Сохранить') +
                    `</div></form></div>`;
                TrelloUI.openModal(content, 'Настройки');

                const trebisData: HTMLElement = document.getElementById('trebis_data');
                trebisData.onsubmit = e => {
                    e.stopPropagation();
                    const keyElement: HTMLInputElement = document.getElementById(tKey) as HTMLInputElement;
                    const tokenElement: HTMLInputElement = document.getElementById(tToken) as HTMLInputElement;
                    const data: ILocalStorage = {
                        key: keyElement.value,
                        token: tokenElement.value
                    };
                    this._setLocalStorage(data);
                    TrelloUI.closeModal();
                };
                if (localStorage) {
                    const getOrgId: HTMLElement = document.getElementById('trebis_getOrdId');
                    getOrgId.onclick = e => {
                        e.preventDefault();
                        TrelloUI.closeModal();
                        this.openSettingModal(false);
                    };
                }
            } else {
                let contentHTML = `<div class="window-main-col" style="margin:12px 40px 8px 56px;">`;
                const boards = await this._trebis.trello.getMembers();
                const orgName = Trebis.getOrgName();
                if (boards && boards.organizations) {
                    const formName = 'trebis_board-id';
                    const radioName = 'trebis_org-name';
                    contentHTML += `<form action="#" class="${formName}"><label for="${formName}">Выберите рабочее пространство для работы:</label>`
                    boards.organizations.forEach((org) => {
                        let value = org.name;
                        if (org.desc) {
                            value += ` | (${org.desc.slice(0, 15)}...)`;
                        }
                        contentHTML += `<p class="${radioName}" style="cursor: pointer;"><input type="radio" style="margin-right: 7px;" name="${radioName}" value="${org.name}|${org.id}" ${orgName === org.name ? 'checked' : ''}>${value}</p>`
                    });
                    contentHTML += TrelloUI.getButton('Сохранить');
                    contentHTML += '</form>';
                    TrelloUI.openModal(contentHTML, 'Выбор рабочего пространства по умолчанию');

                    const tForm: HTMLFormElement = document.querySelector(`.${formName}`);
                    tForm.onsubmit = (e) => {
                        e.stopPropagation();
                        const selectValue = tForm.elements[radioName]?.value;
                        if (selectValue) {
                            const parseValue = selectValue.split('|');
                            utils.setLocalStorage(Trebis.SAVED_ORG_NAME, parseValue[0]);
                            utils.setLocalStorage(Trebis.SAVED_ORG_ID, parseValue[1]);
                        }
                        TrelloUI.closeModal();
                    }
                    tForm.onclick = (e) => {
                        const target = e.target as HTMLElement;
                        if (target.classList.value === radioName) {
                            (target.children[0] as HTMLInputElement).checked = true;
                        }
                    }
                } else {
                    contentHTML += '<p>Нет рабочих пространств</p>';
                }
                contentHTML += '</div>';
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
                TrelloUI.getButton('Получить', this.STAT_BTN, 'width:100%') +
                '</div></div>';

            if (isFull) {
                const year = (new Date()).getFullYear();
                res += `<div style="display:flex;float:left" class="${this.STAT_SERVER_LABEL}">`;
                for (let i = year; i >= 2020; i--) {
                    if (i === (year - 5)) {
                        break;
                    }
                    res += `<p style="${styleLink}">${i}</p>`;
                }
                res += '</div>';
            }

            res += `<div class="${this.STAT_CONTENT}" style="margin:30px 0"></div></div>`;
            return res;
        }

        protected _getStatisticServerResultTemplate(serverData: IServerApiRequestRes, year: string): string {
            let res = '';
            const serverDatas = serverData.data;

            for (const boardName in serverDatas) {
                if (serverDatas.hasOwnProperty(boardName)) {
                    res += `<div><h3>Информация о доске <u>${boardName}</u></h3><table>`;
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
                return '<p style="color:red">Нет данных</p>';
            }
            return `<div>${res}</div>`;
        }

        protected _getMonthText(month: number): string {
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

        private _saveStatistic(contentHtml: HTMLElement): void {
            const saveStat = 'trebis_save-stat';
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
                await this._getBoardId();
                TrelloUI.successNotification('Получение данных');
                const statInfo = await this._trebis.getStatistic(dateStart, dateEnd);
                const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                if (statInfo) {
                    statisticContent.innerHTML =
                        `<h2>Информация с ${dateStart} по ${dateEnd}</h2><table>${this._getStatisticResultTemplate(statInfo, 'Итог')}</table>`;
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
                const orgName = Trebis.getOrgName();
                const orgBoards: ITrelloOrg = await this._trebis.trello.getOrganizations(orgName);
                const statisticContent: HTMLElement = document.querySelector(`.${this.STAT_CONTENT}`);
                if (orgBoards?.boards) {
                    statisticContent.innerHTML = `<h2>Информация с ${dateStart} по ${dateEnd}</h2>`;
                    for (const board of orgBoards.boards) {
                        this._trebis.boardId = board.id;
                        TrelloUI.successNotification(`Получение данных по доске ${board.name}`);
                        const statInfo = await this._trebis.getStatistic(dateStart, dateEnd,
                            {
                                boardName: board.name,
                                isSaveOnServer: true
                            });
                        if (statInfo) {
                            statisticContent.innerHTML += '<div style="margin:15px 0;">' +
                                `<h3>Информация по доске <u>${board.name}</u></h3>` +
                                `<table>${this._getStatisticResultTemplate(statInfo, 'Итог')}</table></div>`;
                        } else {
                            statisticContent.innerHTML += `<p style="color:red">Произошла ошибка при получении доски <u>${board.name}</u></p>`;
                        }
                    }
                    this._saveStatistic(statisticContent);
                    TrelloUI.successNotification(`Статистика получена`);
                } else {
                    statisticContent.innerHTML = '<span style="color:red">Произошла ошибка при получении информации</span>';
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
            let infoText = 'Не выполненных задач';
            if (old.red < current.red) {
                red = el(current.red - old.red, 'red', `Плохо! ${infoText} больше`);
            } else {
                red = el(old.red - current.red, 'green', `Супер! ${infoText} меньше`);
            }
            infoText = 'Перенесенных задач'
            if (old.yellow < current.yellow) {
                yellow = el(current.yellow - old.yellow, 'red', `Плохо! ${infoText} больше`);
            } else {
                yellow = el(old.yellow - current.yellow, 'green', `Good! ${infoText} меньше`);
            }
            infoText = 'Выполненных задач';
            if (old.green < current.green) {
                green = el(current.green - old.green, 'green', `Супер! ${infoText} больше`);
            } else {
                green = el(old.green - current.green, 'red', `Не очень! ${infoText} меньше`);
            }
            if (old.blue < current.blue) {
                blue = el(current.blue - old.blue, 'green', 'Отлично! Выполненных вне плана задач больше');
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
                const comparisonCallback = async (thisMonth: string, oldMonth: string) => {
                    const thisDate = utils.getThisMonth();
                    const statInfo = await this._trebis.getStatistic(thisDate.start, thisDate.end);
                    const oldDate = utils.getOldMonth();
                    const statInfoOld = await this._trebis.getStatistic(oldDate.start, oldDate.end);
                    if (statInfo && statInfoOld) {
                        statisticContent.innerHTML += '<table>' +
                            this._getStatisticResultTemplate(statInfo, thisMonth) +
                            this._getStatisticResultTemplate(statInfoOld, oldMonth) +
                            this._getStatisticResultTemplate(this._comparisonEqual(statInfoOld, statInfo), 'Итог') +
                            '</table>';
                    } else {
                        statisticContent.innerHTML += '<p style="color:red">Произошла ошибка при получении доски</p>';
                    }
                };
                TrelloUI.showIndicator();
                const month = (new Date()).getMonth();
                const thisMonth = this._getMonthText(month);
                const oldMonth = this._getMonthText(month - 1);
                statisticContent.innerHTML = `<h2>Сравнение за ${thisMonth} и ${oldMonth}</h2>`;
                if (isFull) {
                    const orgName = Trebis.getOrgName();
                    const orgBoards: ITrelloOrg = await this._trebis.trello.getOrganizations(orgName);
                    if (orgBoards && orgBoards.boards) {
                        for (const board of orgBoards.boards) {
                            this._trebis.boardId = board.id;
                            statisticContent.innerHTML += `<h3>Информация по доске <u>${board.name}</u></h3>`;
                            TrelloUI.successNotification(`Получение данных по доске ${board.name}`);
                            await comparisonCallback(thisMonth, oldMonth);
                        }
                    }
                } else {
                    await this._getBoardId();
                    TrelloUI.successNotification('Получение данных');
                    await comparisonCallback(thisMonth, oldMonth);
                }
                TrelloUI.hideIndicator();
            };
            await this._getTrebisQuery(callback);
        }

        protected async _getStatisticFromServer(year: string): Promise<string> {
            const serverApi = new ServerApi();
            const orgId = await this._trebis.getOrgId();
            const statData = await serverApi.get(year, orgId);
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
                const statisticName = `${prefix}statistic`;
                const trashName = `${prefix}trash`;
                let innerHtml = TrelloUI.getHeaderButton({
                    id: addListName,
                    title: 'Нажмите для создания списка',
                    label: 'add',
                    icon: 'add'
                });
                innerHtml += TrelloUI.getHeaderButton({
                    id: runScriptName,
                    title: 'Нажмите для переноса карточек',
                    label: 'card',
                    icon: 'card-recurring'
                });
                let memberMenu: HTMLElement = document.querySelector('.js-open-header-member-menu');
                let isShowDropButton = false;
                if (memberMenu) {
                    if (!memberMenu.title) {
                        memberMenu = memberMenu.children[0] as HTMLElement;
                    }
                    const userName = (memberMenu.title.match(/\(([^)]+)\)/gi))[0]?.replace(/[()]/gi, '');
                    let adminUsers = this.ADMIN_USERS;
                    const storageAdminUsers = utils.getLocalStorage('admins');
                    if (storageAdminUsers) {
                        adminUsers = JSON.parse(storageAdminUsers);
                    }
                    if (adminUsers.includes(userName)) {
                        isShowDropButton = true;
                        innerHtml += TrelloUI.getHeaderButton({
                            id: trashName,
                            title: 'Нажмите для удаления старых списков',
                            label: 'trash',
                            icon: 'trash'
                        });
                    }
                }
                innerHtml += TrelloUI.getHeaderButton({
                    id: statisticName,
                    title: 'Нажмите для получения статистики',
                    label: 'info',
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
                TrelloUI.addInBoardHeader(buttons, callbacks);
            }
        }

        public createOrgButtons() {
            if (!document.getElementById(Application.ORG_SELECTOR)) {
                const prefix = 'trebis_button_org';
                const statisticName = `${prefix}-statistic`;
                const settingName = `${prefix}-setting`;
                let innerHtml = TrelloUI.getHeaderButton({
                    id: statisticName,
                    title: 'Нажмите для получения общей статистики',
                    label: 'info',
                    icon: 'information'
                });
                innerHtml += TrelloUI.getHeaderButton({
                    id: settingName,
                    title: 'Нажмите для открытия настроек',
                    label: 'gear',
                    icon: 'gear'
                });
                const buttons = document.createElement('div');
                buttons.id = Application.ORG_SELECTOR;
                buttons.innerHTML = innerHtml;
                // Без этого, кнопку расположатся друг под другом
                buttons.style.flexShrink = '0';
                const callbacks: ITrelloUiCallback[] = [
                    {
                        id: statisticName,
                        callback: this.statisticOrgHandler.bind(this)
                    }
                ];
                callbacks.push({
                    id: settingName,
                    callback: this.settingHandler.bind(this)
                });
                TrelloUI.addInHeader(buttons, callbacks)
            }
        }
    }
}

