import {Request} from "./Request";
import {TREBIS as utils} from "../utils";
import {IRequestSend, ITrebisLabel, ITrelloCardData, ITrelloData, ITrelloListData, ITrelloOrg} from "../interfaces";

/**
 * Класс отвечающий за работу с trello api
 */
export class TrelloApi {
    private _request: Request;
    public key: string;
    public token: string;
    public isSendForApi: boolean = false;
    public trelloToken: string;
    /**
     * Можно отправлять запросы на trello.com не используя api.
     * По сути разницы нет, только в 1 случае нам не нужно беспокоиться о том, что нужно вводить ключ и токен
     */
    public readonly DEFAULT_URL = 'https://trello.com';
    public readonly API_URL = 'https://api.trello.com';

    public constructor() {
        this._request = new Request();
        this._request.header = Request.HEADER_AP_JSON;
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
        }
        return {...{token: this.trelloToken}, ...data};
    }

    protected _getQuery(data: ITrelloData = {}, prefix: string = '&'): string {
        let query: string = '';
        if (this.isSendForApi) {
            query = prefix + Request.getQueryString(this._getPost(data));
        }
        this._request.post = null;
        return query;
    }

    /**
     * Получаем информацию об организации включая доступные доски
     * @param orgName
     */
    public async getOrganizations(orgName: string): Promise<ITrelloOrg> {
        this._request.url = this._getUrl() + `/1/Organizations/${orgName}?boards=open&board_fields=name%2Cclosed%2CdateLastActivity%2CdateLastView%2CdatePluginDisable%2CenterpriseOwned%2CidOrganization%2Cprefs%2CpremiumFeatures%2CshortLink%2CshortUrl%2Curl%2CcreationMethod%2CidEnterprise%2CidTags&board_starCounts=organization&board_membershipCounts=active&fields=name%2CdisplayName%2Cproducts%2Cprefs%2CpremiumFeatures%2ClogoHash%2CidEnterprise%2Ctags%2Climits%2Ccredits%2Cdesc%2CdescData%2Cwebsite%2Climits%2CbillableCollaboratorCount&paidAccount=true&paidAccount_fields=products%2Cstanding%2CbillingDates%2CexpirationDates%2CneedsCreditCardUpdate%2CdateFirstSubscription&enterprise=true&memberships=active&members=all&tags=true&billableCollaboratorCount=true${this._getQuery()}`;
        const send = await this._request.send();
        return send.data;
    }

    /**
     * Получение всех досок пользователя
     */
    public async getBoards() {
        this._request.url = `${this._getUrl()}/1/members/me/boards?fields=name%2CshortLink${this._getQuery()}`;
        const send = await this._request.send();
        return send.data;
    }

    /**
     * Получение всех списков пользователя на определенно доске
     * @param boardId
     */
    public async getLists(boardId: string): Promise<ITrelloListData[]> {
        this._request.url = `${this._getUrl()}/1/boards/${boardId}/lists${this._getQuery({}, '?')}`;
        const send = await this._request.send();
        return send.data;
    }

    /**
     * Удаление определенного списка
     *
     * Самого удаления нет. Просто скрываются лишние списки.
     * @param listId
     */
    public async deleteList(listId: string) {
        this._request.header['Accept'] = 'application/json';
        this._request.customRequest = 'PUT';
        this._request.url = `${this._getUrl()}/1/lists/${listId}/`;
        this._request.post = this._getPost({closed: true});
        const res = await this._request.send();
        this._request.customRequest = null;
        this._request.header = Request.HEADER_AP_JSON;
        return res;
    }

    /**
     * Добавление списка
     * @param data
     */
    public async addList(data: ITrelloData): Promise<IRequestSend> {
        this._request.post = this._getPost({
            pos: "top",
            name: data.name || utils.date(),
            idBoard: data.idBoard
        });
        this._request.url = this._getUrl() + "/1/lists";
        return await this._request.send();
    }

    /**
     * Получение всех карточек из списка
     * @param listId
     */
    public async getCards(listId: string): Promise<ITrelloCardData[]> {
        this._request.url = `${this._getUrl()}/1/lists/${listId}/cards?fields=all${this._getQuery()}`;
        const send = await this._request.send();
        return send.data;
    }

    /**
     * Получение всех меток доски
     * @param boardId
     */
    public async getLabels(boardId: string): Promise<ITrebisLabel[]> {
        this._request.url = `${this._getUrl()}/1/boards/${boardId}/labels${this._getQuery({}, '?')}`;
        const send = await this._request.send();
        return send.data;
    }

    /**
     * Добавление метки для карточки
     * @param cardId
     * @param labelId
     */
    public async addLabels(cardId: string, labelId: string): Promise<IRequestSend> {
        this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels`;
        this._request.post = this._getPost({value: labelId});
        return await this._request.send();
    }

    public async deleteLabels(cardId: string, labelId: string): Promise<IRequestSend> {
        this._request.customRequest = "DELETE";
        this._request.url = `${this._getUrl()}/1/cards/${cardId}/idLabels/${labelId}${this._getQuery({}, '?')}`;
        const res = await this._request.send();
        this._request.customRequest = null;
        return res;
    }

    /**
     * Обновление карточки
     * @param cardId
     * @param data
     */
    public async updateCard(cardId: string, data: ITrelloData = {}): Promise<ITrelloCardData> {
        this._request.header['Accept'] = 'application/json';
        this._request.customRequest = 'PUT';
        this._request.url = `${this._getUrl()}/1/cards/${cardId}`;
        this._request.post = this._getPost(data);
        const res = await this._request.send();
        this._request.customRequest = null;
        this._request.header = Request.HEADER_AP_JSON;
        return res;
    }

    /**
     * Добавление карточки
     * @param data
     */
    public async addCard(data: ITrelloData): Promise<ITrelloCardData> {
        this._request.url = this._getUrl() + "/1/cards";
        this._request.post = this._getPost(data);
        return await this._request.send();
    }

    /**
     * Копирование карточки
     * @param data
     * @param copyCardId
     */
    public async copyCard(data: ITrelloData, copyCardId: string): Promise<ITrelloCardData> {
        if (copyCardId) {
            data.idCardSource = copyCardId;
            data.keepFromSource = ["start", "due", "comments", "attachments", "checklists", "members", "stickers"];
        }
        return await this.addCard(data);
    }
}
