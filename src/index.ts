interface IRequestSend {
    /**
     * Статус ответа. True, если запрос успешно выполнился, иначе false.
     */
    status: boolean;
    /**
     * Полученные данные.
     */
    data?: any;
    /**
     * Ошибка при отправке запроса.
     */
    err?: string
}

interface IGetParams {
    [key: string]: string;
}

interface ITrelloData {
    key?: string;
    token?: string;

    [key: string]: any;
}

interface ITrelloListData {
    id?: string;
    name?: string;

    [key: string]: any;
}

interface ITrelloLabel {
    color: string;
    id: string;
}

interface ITrelloCardData {
    id?: string;
    name?: string;
    desc?: string;
    labels?: ITrelloLabel[];

    [key: string]: any;
}

interface ITrebisLabel {
    [color: string]: string;
}

interface ILocalStorage {
    key: string;
    token: string;

}

namespace TREBIS {
    /**
     * Класс отвечающий за отправку curl запросов на необходимый url.
     *
     * @class TRequest
     */
    class TRequest {
        public static readonly HEADER_RSS_XML: Record<string, string> = {'Content-Type': 'application/rss+xml'};
        public static readonly HEADER_GZIP: Record<string, string> = {'Content-Encoding': 'gzip'};
        public static readonly HEADER_AP_JSON: Record<string, string> = {'Content-Type': 'application/json'};
        public static readonly HEADER_AP_XML: Record<string, string> = {'Content-Type': 'application/xml'};
        public static readonly HEADER_FORM_DATA: Record<string, string> = {'Content-Type': 'multipart/form-data'};

        /**
         * Адрес, на который отправляется запрос.
         */
        public url: string;
        /**
         * Get параметры запроса.
         */
        public get: IGetParams;
        /**
         * Post параметры запроса.
         */
        public post: any;
        /**
         * Отправляемые заголовки.
         */
        public header: HeadersInit;
        /**
         * Кастомный (Пользовательский) заголовок (DELETE и тд.).
         */
        public customRequest: string;
        /**
         * Максимально время, за которое должен быть получен ответ. В мсек.
         */
        public maxTimeQuery: number;
        /**
         * Формат ответа.
         * True, если полученный ответ нужно преобразовать как json. По умолчанию true.
         */
        public isConvertJson: boolean;

        /**
         * Ошибки при выполнении запроса.
         */
        private _error: string;

        /**
         * TRequest constructor.
         */
        public constructor() {
            this.url = null;
            this.get = null;
            this.post = null;
            this.header = null;
            this.customRequest = null;
            this.maxTimeQuery = null;
            this.isConvertJson = true;
            this._error = '';
        }

        /**
         * Получение корректного  параметра для отправки запроса.
         * @return RequestInit
         * @private
         */
        protected _getOptions(): RequestInit {
            const options: RequestInit = {};

            if (this.maxTimeQuery) {
                const controller = new AbortController();
                const signal: AbortSignal = controller.signal;
                const timeoutId = setTimeout(() => controller.abort(), this.maxTimeQuery);
                options.signal = signal;
            }

            let post: object = null;
            if (this.post) {
                post = {...{}, ...this.post};
            }
            if (post) {
                options.method = 'POST';
                options.body = JSON.stringify(post);
            }

            if (this.header) {
                options.headers = this.header;
            }

            if (this.customRequest) {
                options.method = this.customRequest;
            }
            return options;
        }

        protected _getQueryString(params): string {
            return Object.keys(params)
                .map(key => `${key}=${params[key]}`)
                .join('&');
        }

        /**
         * Получение url адреса с get запросом.
         *
         * @return string
         * @private
         */
        protected _getUrl(): string {
            let url: string = this.url;
            if (this.get) {
                url += '?' + this._getQueryString(this.get);
            }
            return url;
        }

        /**
         * Начинаем отправку fetch запроса.
         * В случае успеха возвращаем содержимое запроса, в противном случае null.
         *
         * @return Promise<any>
         */
        private async _run(): Promise<any> {
            if (this.url) {
                const response = await fetch(this._getUrl(), this._getOptions());
                if (response.ok) {
                    if (this.isConvertJson) {
                        return await response.json();
                    }
                    return await response.text();
                }
                this._error = 'Не удалось получить данные с ' + this.url;
            } else {
                this._error = 'Не указан url!';
            }
            return null;
        }

        /**
         * Отправка запроса.
         * Возвращаем массив. В случае успеха свойство 'status' = true.
         *
         * @param {string} url Адрес, на который отправляется запрос.
         * @return Promise<IRequestSend>
         * [
         *  - bool status Статус выполнения запроса.
         *  - mixed data Данные полученные при выполнении запроса.
         * ]
         * @api
         */
        public async send(url: string = null): Promise<IRequestSend> {
            if (url) {
                this.url = url;
            }

            this._error = null;
            const data: any = await this._run();
            if (this._error) {
                return {status: false, err: this._error};
            }
            return {status: true, data};
        }
    }

    /**
     * Класс отвечающий за работу с trello api
     */
    class TrelloApi {
        private _request: TRequest;
        public key: string;
        public token: string;
        public isSendForApi: boolean = false;
        public trelloToken: string;
        public readonly DEFAULT_URL = 'https://trello.com';
        public readonly API_URL = 'https://api.trello.com';

        public constructor() {
            this._request = new TRequest();
            this._request.header = TRequest.HEADER_AP_JSON;
        }

        protected _getUrl(): string {
            if (this.isSendForApi) {
                return this.API_URL;
            }
            return this.DEFAULT_URL;
        }

        protected _getPost(data: ITrelloData): ITrelloData {
            if (this.isSendForApi) {
                return {...{key: this.key, token: this.token}, ...data};
            } else {
                return {...{token: this.trelloToken}, ...data};
            }
        }

        protected _getQueryString(params): string {
            return Object.keys(params)
                .map(key => `${key}=${params[key]}`)
                .join('&');
        }

        public async getBoards() {
            let query: string = '';
            if (this.isSendForApi) {
                query = '&' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = this._getUrl() + '/1/members/me/boards?fields=name' + query;
            const send = await this._request.send();
            return send.data;
        }

        public async getLists(boardId: string): Promise<ITrelloListData[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/boards/${boardId}/lists` + query;
            const send = await this._request.send();
            return send.data;
        }

        public async deleteList(listId: string) {
            this._request.url = `${this._getUrl()}/1/lists/${listId}/`;
            this._request.post = this._getPost({closed: true});
            return await this._request.send();
        }

        public isLink(text: string): boolean {
            if (text) {
                return !!text.match(/((http|s:\/\/)[^( |\n)]+)/umig);
            }
            return false;
        }

        public async addList(data: ITrelloData): Promise<IRequestSend> {
            this._request.post = this._getPost({
                pos: "top",
                name: data.name || Trebis.date(),
                idBoard: data.idBoard
            });
            this._request.url = this._getUrl() + "/1/lists";
            return await this._request.send();
        }

        public async getCards(listId: string): Promise<ITrelloCardData[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '&' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/lists/${listId}/cards?fields=all` + query;
            const send = await this._request.send();
            return send.data;
        }

        public async getLabels(boardId: string): Promise<ITrebisLabel[]> {
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.post = null;
            this._request.url = `${this._getUrl()}/1/boards/${boardId}/labels` + query;
            const send = await this._request.send();
            return send.data;
        }

        public async addLabels(cardId: string, labelId: string): Promise<IRequestSend> {
            this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels`;
            this._request.post = this._getPost({value: labelId});
            return await this._request.send();
        }

        public async deleteLabels(cardId: string, labelId: string): Promise<IRequestSend> {
            this._request.customRequest = "DELETE";
            let query: string = '';
            if (this.isSendForApi) {
                query = '?' + this._getQueryString(this._getPost({}));
            }
            this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels/${labelId}` + query;
            this._request.post = null;
            const res = await this._request.send();
            this._request.customRequest = null;
            return res;
        }

        public async updateCard(cardId: string, data: ITrelloData = {}): Promise<ITrelloCardData> {
            this._request.header['Accept'] = 'application/json';
            this._request.customRequest = 'PUT';
            this._request.url = `${this._getUrl()}/1/cards/${cardId}`;
            if (data.name) {
                const names = data.name.split(' ');
                names.forEach((name) => {
                    if (this.isLink(name)) {
                        if (data.desc.indexOf(name) === -1) {
                            data.desc = `[Ссылка на задачу](${name})\n${data.desc}`;
                        }
                    }
                })
            }
            this._request.post = this._getPost(data);
            const res = await this._request.send();
            this._request.customRequest = null;
            this._request.header = TRequest.HEADER_AP_JSON;
            return res;
        }

        public async addCard(data: ITrelloData): Promise<ITrelloCardData> {
            this._request.url = this._getUrl() + "/1/cards";
            this._request.post = this._getPost(data);
            return await this._request.send();
        }
    }

    /**
     * Класс выполняющий необходимые действия для trello
     */
    class Trebis {
        private DAY = 3600 * 24 * 1000;

        public trello: TrelloApi;

        protected labels: ITrebisLabel = null;

        public boardId: string = null;
        public thisListId: string = null;
        protected lastListId: string = null;

        public constructor(key: string = null, token: string = null) {
            this.trello = new TrelloApi();
            this.initKeyToken(key, token);
        }

        /**
         * Получение корректной даты в формате d.m
         * @param time
         */
        public static date(time: number = null): string {
            if (time === null) {
                time = Date.now();
            }
            const date = new Date(time);
            let day = date.getDate();
            let month = date.getMonth() + 1;

            let result;
            if (day < 10) {
                result = `0${day}`;
            } else {
                result = day + ``;
            }
            result += '.';
            if (month < 10) {
                result += `0${month}`;
            } else {
                result += month;
            }
            return result;
        }

        public initKeyToken(key: string = null, token: string = null): void {
            if (key) {
                this.trello.key = key;
            }
            if (token) {
                this.trello.token = token;
                this.trello.isSendForApi = true;
            }
        }

        public async getBoardId(boardName: string): Promise<string> {
            const boards = await this.trello.getBoards();
            this.boardId = null;
            boards.forEach((board) => {
                if (board.name === boardName) {
                    this.boardId = board.id;
                }
            })
            return this.boardId;
        }

        public async initLabels(): Promise<void> {
            if (this.boardId) {
                const labels = await this.trello.getLabels(this.boardId);
                this.labels = {};
                labels.forEach((label) => {
                    this.labels[label.color] = label.id;
                })
            } else {
                this._logs('initLabels(): Не указал идентификатор доски!');
            }
        }

        public async createList(): Promise<void> {
            this.thisListId = null;
            if (this.boardId) {
                const result = await this.trello.addList({idBoard: this.boardId});
                if (result.status && result.data) {
                    this.thisListId = result.data.id || null;
                }
            } else {
                this._logs('createList(): Не указал идентификатор доски!');
            }
        }

        public getListId(lists: ITrelloListData[], name: string): string {
            for (const list of lists) {
                if (list.name === name) {
                    return list.id;
                }
            }
            return null;
        }

        protected async initListId(lists: ITrelloListData[]): Promise<void> {
            if (!this.thisListId) {
                this.thisListId = await this.getListId(lists, Trebis.date());
                if (this.thisListId) {
                    await this.createList();
                }
            }

            let day = 1;
            do {
                const name: string = Trebis.date(Date.now() - (this.DAY * day));
                this.lastListId = await this.getListId(lists, name);
                day++;
                if (day > 15) {
                    break;
                }
            } while (!this.lastListId);
        }

        public async createCard(data, labels): Promise<void> {
            const req = await this.trello.addCard(data);
            const cardId = req.data.id || null
            if (cardId) {
                for (const label of labels) {
                    await this.trello.addLabels(cardId, label);
                }
            } else {
                this._logs('CreateCard(): Не удалось создать карточку!');
            }
        }

        public async updateCard(): Promise<void> {
            if (this.boardId) {
                const lists: ITrelloListData[] = await this.trello.getLists(this.boardId);
                await this.initListId(lists);

                if (this.lastListId) {
                    const thisCards: ITrelloCardData[] = await this.trello.getCards(this.thisListId);
                    const lastCards: ITrelloCardData[] = await this.trello.getCards(this.lastListId);

                    for (let lastCard of lastCards) {
                        const data = {
                            name: lastCard.name,
                            desc: lastCard.desc
                        };
                        const updateCard = await this.trello.updateCard(lastCard.id, data);
                        if (updateCard.status && updateCard.data) {
                            lastCard = updateCard.data;
                        }
                        let addedCard = true;
                        let addedLabels: string[] = [];
                        for (const label of lastCard.labels) {
                            if (['green', 'blue'].indexOf(label.color) !== -1) {
                                addedCard = false;
                                addedLabels = [];
                                break;
                            }
                            if (label.color !== 'red') {
                                addedLabels.push(label.id);
                            }
                        }
                        if (addedCard) {
                            let isAdded = true;
                            for (const thisCard of thisCards) {
                                if (thisCard.name === lastCard.name) {
                                    isAdded = false;
                                    break;
                                }
                            }
                            if (isAdded) {
                                const data = {
                                    idList: this.thisListId,
                                    name: lastCard.name,
                                    desc: lastCard.desc
                                };
                                addedLabels.push(this.labels.yellow);
                                await this.createCard(data, addedLabels);
                                await this.trello.addLabels(lastCard.id, this.labels.red);
                            }
                        }
                    }
                } else {
                    this._logs('updateCard(): Не удалось найти карточку за предыдущий рабочий день!');
                }
            } else {
                this._logs('updateCard(): Не указал идентификатор доски!');
            }
        }

        public async removeOldLists(lists: ITrelloListData[]) {
            let day = 7;
            // todo придумать как сделать сейчас не понятно как корректно отфильтровать карточки
            lists.forEach((list) => {
                if (day === 0) {
                    this.trello.deleteList(list.id);
                } else {
                    day--;
                }
            })
        }

        public async getStatistic() {

        }

        protected _logs(error: string): void {
            console.error(error);
        }
    }

    function getLocalStorage(): ILocalStorage {
        if (localStorage.trebis_key && localStorage.trebis_token) {
            return {
                key: localStorage.trebis_key,
                token: localStorage.trebis_token,
            }
        }
        return null;
    }

    function getBoardName(): string {
        const boardName: HTMLInputElement = document.querySelector('.board-name-input');
        if (boardName) {
            return boardName.value;
        }
        return '';
    }

    function setLocalStorage(storage: ILocalStorage) {
        localStorage.setItem('trebis_key', storage.key);
        localStorage.setItem('trebis_token', storage.token);
    }

    function getCookie(name) {
        let matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
        return matches ? decodeURIComponent(matches[1]) : undefined
    }

    async function runHandler(e: Event): Promise<void> {
        e.preventDefault();
        const trelloToken = getCookie('token');
        let localStorage: ILocalStorage = null;
        if (!trelloToken) {
            localStorage = getLocalStorage();
        }
        if (trelloToken || localStorage) {
            const trebis = new Trebis();
            let boardName = getBoardName();
            if (!trelloToken) {
                const key = localStorage.key;
                const token = localStorage.token;
                trebis.initKeyToken(key, token);
            } else {
                trebis.trello.isSendForApi = false;
                trebis.trello.trelloToken = trelloToken;
            }

            await trebis.getBoardId(boardName);
            // Добавляем список
            const lists: ITrelloListData[] = await trebis.trello.getLists(trebis.boardId);
            const thisListId = await trebis.getListId(lists, Trebis.date());
            if (thisListId === null) {
                await trebis.createList();
            } else {
                trebis.thisListId = thisListId;
            }
            // Обновляем карточки
            await trebis.initLabels();
            await trebis.updateCard();
        } else {
            openSettingModal()
        }
    }

    function settingHandler(e: Event) {
        e.preventDefault();
        openSettingModal();
    }

    async function removeHandler(e: Event) {
        e.preventDefault();
        let isRemoveLists = false;

        if (confirm('Уверены что хотите удалить старые карточки?')) {
            if (confirm('Прям на все 100% уверены?')) {
                isRemoveLists = true;
            }
        }

        if (isRemoveLists) {
            const trelloToken = getCookie('token');
            let localStorage: ILocalStorage = null;
            if (!trelloToken) {
                localStorage = getLocalStorage();
            }
            if (trelloToken || localStorage) {
                const trebis = new Trebis();
                let boardName = getBoardName();
                if (!trelloToken) {
                    const key = localStorage.key;
                    const token = localStorage.token;
                    trebis.initKeyToken(key, token);
                } else {
                    trebis.trello.isSendForApi = false;
                    trebis.trello.trelloToken = trelloToken;
                }

                await trebis.getBoardId(boardName);
                // Добавляем список
                let lists: ITrelloListData[] = await trebis.trello.getLists(trebis.boardId);
                const thisListId = await trebis.getListId(lists, Trebis.date());
                if (thisListId === null) {
                    await trebis.createList();
                } else {
                    trebis.thisListId = thisListId;
                }
                // Обновляем карточки
                await trebis.initLabels();
                await trebis.updateCard();
                lists = null;
            } else {
                openSettingModal()
            }
        }
    }

    function openSettingModal() {
        let key = '';
        let token = '';
        const localStorage = getLocalStorage();
        if (localStorage) {
            key = localStorage.key;
            token = localStorage.token;
        }

        const content: string = '<div class="window-main-col" style="margin: 12px 40px 8px 56px;">' +
            '<span>Ключ и токен можно получить <a href="https://trello.com/app-key" target="_blank">тут</a></span>' +
            '<form action="#" id="trebis-data">' +
            '<div>' +
            '<label for="trebis-key">key</label>' +
            `<input type="text" id="trebis-key" style="width: 100%" value="${key}">` +
            '</div>' +
            '<div>' +
            '<label for="trebis-token">token</label>' +
            `<input type="text" id="trebis-token" style="width: 100%"  value="${token}">` +
            '</div>' +
            '<div>' +
            '<button class="nch-button--primary">Сохранить</button>' +
            '</div>' +
            '</form>' +
            '</div>';
        openModal(content);

        const trebisData: HTMLElement = document.getElementById('trebis-data');
        trebisData.onsubmit = (e) => {
            e.stopPropagation();
            const keyElement: HTMLElement = document.getElementById('trebis-key');
            const tokenElement: HTMLElement = document.getElementById('trebis-token');
            const data: ILocalStorage = {
                // @ts-ignore
                key: keyElement.value,
                // @ts-ignore
                token: tokenElement.value
            }
            setLocalStorage(data);
            closeModal();
        }
    }

    function openModal(content) {
        document.querySelector('body').classList.add('window-up');
        const trelloWindow: HTMLElement = document.querySelector('.window');
        if (trelloWindow) {
            trelloWindow.style.display = 'block';
            const windowWrapper = document.querySelector('.window-wrapper');
            windowWrapper.innerHTML = '<a class="icon-md icon-close dialog-close-button js-close-window" href="#"></a>';
            const windowContent = document.createElement('div');
            windowContent.classList.add('card-detail-window', 'u-clearfix');
            windowContent.innerHTML = content
            windowWrapper.append(windowContent);
            const dialogCloseButton: HTMLElement = document.querySelector('.dialog-close-button');
            if (dialogCloseButton) {
                dialogCloseButton.onclick = closeModal;
            }
        }
    }

    function closeModal() {
        document.querySelector('body').classList.remove('window-up');
        const trelloWindow: HTMLElement = document.querySelector('.window');
        trelloWindow.style.display = 'none';
    }

    function createButtons() {
        const boardHeader = document.querySelector('.board-header');
        if (!boardHeader.querySelector('#trebis-buttons')) {
            const isTrebisToken = !!getCookie('token');
            let innerHtml = '<a class="board-header-btn" href="#" id="trebis-button-run" title="Нажмите, чтобы автоматически создать карточку, и перенести все не выполненные задачи." aria-label="Запуск скрипта"><span class="icon-sm icon-card board-header-btn-icon"></span></a>'
            if (!isTrebisToken) {
                innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-setting" title="Нажмите, чтобы изменить свои данные." aria-label="Открытие настроек"><span class="icon-sm icon-gear board-header-btn-icon"></span></a>'
            }
            innerHtml += '<a class="board-header-btn" href="#" id="trebis-button-trash" title="Нажмите, чтобы удалить старые карточки." aria-label="Удаление старых карточек"><span class="icon-sm icon-trash board-header-btn-icon"></span></a>';
            const buttons = document.createElement('div');
            buttons.id = 'trebis-buttons';
            buttons.innerHTML = innerHtml;

            boardHeader.prepend(buttons);

            const runButton = document.getElementById('trebis-button-run');
            const trashButton = document.getElementById('trebis-button-trash');
            runButton.onclick = runHandler;
            trashButton.onclick = removeHandler;
            if (!isTrebisToken) {
                const settingButton = document.getElementById('trebis-button-setting');
                settingButton.onclick = settingHandler;
            }
        }
    }

    export function init() {
        createButtons();
        let observer = new MutationObserver(createButtons);
        observer.observe(document.querySelector('.board-header'), {
            childList: true, // наблюдать за непосредственными детьми
            subtree: true, // и более глубокими потомками
        });
    }
}

window.onload = () => {
    /**
     * Ждем пока страница полностью загрузится.
     * При этом проверяем что есть имя доски
     */
    if (document.location.host === 'trello.com' && document.querySelector('.board-name-input')) {
        TREBIS.init();
    }
}

