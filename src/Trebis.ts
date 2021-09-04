import {TrelloApi} from "./api/TrelloApi";
import {ServerApi} from "./api/ServerApi";
import {TREBIS as utils} from "./utils";
import {TrelloUI} from "./TrelloUI";
import {
    IServerApiData,
    ITrebisLabel,
    ITrebisListId,
    ITrebisStatistic,
    ITrelloCardData,
    ITrelloListData,
    ITrelloMembers,
    ITrelloOrg
} from "./interfaces";

export class Trebis {
    public static ORG_NAME = 'basecontrol';
    public trello: TrelloApi;

    protected labels: ITrebisLabel = null;

    public boardId: string = null;
    public thisListId: ITrebisListId = null;
    protected lastListId: ITrebisListId = null;

    public constructor(key: string = null, token: string = null) {
        this.trello = new TrelloApi();
        this.initKeyToken(key, token);
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

    protected async _getOrg(members: ITrelloMembers): Promise<ITrelloOrg> {
        if (members && members.organizations) {
            for (const org of members.organizations) {
                // todo хз на сколько это хорошее решение. Стоит найти более лучший способ находить нужную организацию
                const whiteList = [
                    'sbis', 'trebis', 'сбис'
                ]
                const isTrebisOrg = org.desc?.toLowerCase()?.match(new RegExp(whiteList.join('|'))) ||
                    org.name.indexOf('_ts') === 0;
                if (isTrebisOrg) {
                    utils.setLocalStorage('org_name', org.name);
                    const admins = [];
                    org.memberships.forEach((membership) => {
                        if (members.id === membership.idMember && membership.memberType === 'admin'
                            && !membership.deactivated) {
                            admins.push(members.username);
                        }
                    });
                    if (admins.length) {
                        utils.setLocalStorage('admins', JSON.stringify(admins));
                    }
                    return await this.trello.getOrganizations(org.id);
                }
            }
        }
        return null
    }

    public async getOrgBoard(): Promise<ITrelloOrg> {
        const orgName = utils.getLocalStorage('org_name');
        if (orgName) {
            return await this.trello.getOrganizations(orgName);
        }
        const boards = await this.trello.getOrganizations(Trebis.ORG_NAME);
        if (boards) {
            utils.setLocalStorage('org_name', Trebis.ORG_NAME);
            return boards;
        }
        const members = await this.trello.getMembers();
        return this._getOrg(members);
    }

    /**
     * Получение идентификатора доски.
     * Он нужен для добавления, обновления и удаления карточек и списков
     * @param shortLink
     */
    public async getBoardId(shortLink: string): Promise<string> {
        const key = `${shortLink}_board-id`;
        const localBoardId = utils.getLocalStorage(key);
        if (localBoardId) {
            this.boardId = localBoardId;
            return localBoardId;
        }
        /**
         * Получаем все доски пользователя
         */
        let boards = await this.trello.getBoards();
        this.boardId = null;
        boards.forEach((board) => {
            if (shortLink.includes(board.shortLink)) {
                this.boardId = board.id;
            }
        });
        if (!this.boardId) {
            /**
             * Может быть так, что у пользователя нет доски, но при этом он привязан к доске организации
             * Поэтому получаем все доски организации и ищем нужную доску.
             * + в том, что можно залезть в чужую доску и работать с ней
             */
            boards = (await this.getOrgBoard())?.boards;
            if (boards) {
                boards.forEach((board) => {
                    if (shortLink.includes(board.shortLink)) {
                        this.boardId = board.id;
                    }
                });
            }
        }
        if (this.boardId) {
            utils.setLocalStorage(key, this.boardId);
        }

        return this.boardId;
    }

    public async getLists(boardId?: string): Promise<ITrelloListData[]> {
        return await this.trello.getLists(boardId || this.boardId, {cards: 'open'});
    }

    protected _getBoardId(methodName): boolean {
        if (!this.boardId) {
            this._logs(`${methodName}(): Не указан id доски`);
            return false;
        }
        return true;
    }

    /**
     * Получаем все метки
     */
    public async initLabels(trelloLabels?: ITrebisLabel[]): Promise<void> {
        const key = `${this.boardId}_labels`;
        const labels = utils.getLocalStorage(key);
        if (labels) {
            this.labels = JSON.parse(labels)
            return;
        }
        if (this._getBoardId('initLabels')) {
            const labels = trelloLabels || await this.trello.getLabels(this.boardId);
            this.labels = {};
            labels.forEach((label) => {
                this.labels[label.color] = label.id;
            });
            utils.setLocalStorage(key, JSON.stringify(this.labels));
        }
    }

    public async createList(name?: string): Promise<boolean> {
        this.thisListId = null;
        if (this._getBoardId('createList')) {
            const result = await this.trello.addList({idBoard: this.boardId, name});
            if (result.status && result.data) {
                this.thisListId = {id: result.data.id, index: null};
                return true;
            }
        }
        return false;
    }

    /**
     * Получаем ид списка
     * @param lists
     * @param name
     */
    public getListId(lists: ITrelloListData[], name: string): ITrebisListId {
        const parseName: Date = utils.getDate(name);
        let index = 0;
        for (const list of lists) {
            const parseListName = utils.getDate(list.name);
            if (name === list.name ||
                ((parseListName && parseName) && utils.isEqualDate(parseListName, parseName))) {
                return {id: list.id, index};
            }
            index++;
        }
        return null;
    }

    /**
     * Получаем ид списка для текущей даты. Если списка нет, то создаем его.
     * Также получаем ид списка с предыдущей даты
     *
     * При этом для оптимизации, ищем список за последние 25 дней.
     *
     * @param lists
     * @protected
     */
    protected async initListId(lists: ITrelloListData[]): Promise<void> {
        if (!this.thisListId) {
            this.thisListId = this.getListId(lists, utils.date());
            if (this.thisListId) {
                await this.createList();
            }
        }

        let day = 1;
        do {
            const name: string = utils.date(Date.now() - utils.getDayInSec(day));
            this.lastListId = this.getListId(lists, name);
            day++;
            if (day > 25) {
                break;
            }
        } while (!this.lastListId);
    }

    public async createCard(data, labels, copyCardId?: string): Promise<void> {
        const req = await this.trello.copyCard(data, copyCardId);
        const cardId = req.data.id || null;
        if (cardId) {
            for (const label of labels) {
                await this.trello.addLabels(cardId, label);
            }
        } else {
            this._logs('CreateCard(): Не удалось создать карточку');
        }
    }

    public async updateCard(trelloLists?: ITrelloListData[]): Promise<number> {
        if (this._getBoardId('updateCard')) {
            const lists: ITrelloListData[] = trelloLists || (await this.getLists());
            await this.initListId(lists);
            let cardCount = 0;

            if (this.lastListId) {
                const initCards = async (listId: ITrebisListId): Promise<ITrelloCardData[]> => {
                    if (listId.index === null) {
                        return [];
                    } else if (typeof lists[listId.index] !== 'undefined') {
                        return lists[listId.index].cards;
                    } else {
                        return await this.trello.getCards(listId.id);
                    }
                }
                const thisCards: ITrelloCardData[] = await initCards(this.thisListId);
                const lastCards: ITrelloCardData[] = await initCards(this.lastListId);

                for (let lastCard of lastCards) {
                    let isUpdatedCard: boolean = false;
                    const data = {
                        name: lastCard.name,
                        desc: lastCard.desc
                    };
                    if (data.name) {
                        const names = data.name.split(' ');
                        names.forEach((name) => {
                            if (utils.isLink(name) && !data.desc.includes(name)) {
                                data.desc = `[Ссылка на задачу](${name})\n${data.desc}`;
                                isUpdatedCard = true;
                            }
                        });
                    }
                    if (isUpdatedCard) {
                        const updateCard = await this.trello.updateCard(lastCard.id, data);
                        if (updateCard.status && updateCard.data) {
                            lastCard = updateCard.data;
                        }
                    }
                    let addedCard = true;
                    let addedLabels: string[] = [];
                    for (const label of lastCard.labels) {
                        if (['green', 'blue'].includes(label.color)) {
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
                                idList: this.thisListId.id,
                                name: lastCard.name,
                                desc: lastCard.desc
                            };
                            addedLabels.push(this.labels.yellow);
                            await this.createCard(data, addedLabels, lastCard.id);
                            await this.trello.addLabels(lastCard.id, this.labels.red);
                            cardCount++;
                        }
                    }
                }
                return cardCount;
            } else {
                this._logs('updateCard(): Не удалось найти карточку за предыдущий рабочий день');
            }
        }
        return null;
    }

    /**
     * Удаление старых списков. Как правильнее сделать не понятно. Поэтому временно оставлю как есть
     * @param lists
     */
    public async removeOldLists(lists: ITrelloListData[]): Promise<number> {
        let day = 30;
        let count = 0;
        // todo придумать как сделать сейчас не понятно как корректно отфильтровать и удалять карточки
        // Сейчас оставляю первые 30 карточек + может быть бага с годами...
        lists.forEach((list) => {
            if (day === 0) {
                this.trello.deleteList(list.id);
                count++;
            } else {
                day--;
            }
        });
        return count;
    }

    private getCorrectDate(oldDate: Date, thisDate: Date): Date {
        if (oldDate === null && thisDate === null) {
            return null;
        }
        const date: Date = thisDate;

        // @ts-ignore
        let difference: number = (oldDate - thisDate);
        difference = difference * (difference < 0 ? (-1) : 1);
        // Если разница больше чем полгода, то скорей всего пользователь опечатался
        if (difference >= 15767993085) {
            date.setFullYear(oldDate.getFullYear());
        }
        return date;
    }

    /**
     * Получение статистики по доске.
     * Важно чтобы boardId был проинициализирован, иначе будет ошибка
     */
    public async getStatistic(startValue: string, endValue: string,
                              options: { isSaveOnServer: boolean, boardName: string } = null): Promise<ITrebisStatistic> {
        if (!this._getBoardId('getStatistic')) {
            return null;
        }
        const lists: ITrelloListData[] = await this.getLists();
        await this.initLabels();
        const res = {
            red: 0,
            yellow: 0,
            blue: 0,
            green: 0
        };
        let isStart = false;

        const startDate: Date = utils.getDate(startValue);
        const endDate: Date = utils.getDate(endValue);
        let oldListDate: Date = null;
        let serverApiData: IServerApiData = {
            name: null,
            data: {}
        };

        for (const list of lists) {
            let listDate: Date = utils.getDate(list.name);
            if (oldListDate && listDate) {
                listDate = this.getCorrectDate(oldListDate, listDate);
            }
            if (oldListDate && oldListDate < listDate) {
                // Если в дате есть год, то все оставляем как есть.
                // Если год не указан, то по умолчанию ставится текущий год, поэтому вычитаем 1 год
                if (list.name.split(list.name.includes('.') ? '.' : '-').length < 3) {
                    listDate.setFullYear(oldListDate.getFullYear() - 1);
                }
            }
            if (list.name === endValue || ((endDate && listDate) && (listDate <= endDate))) {
                isStart = true;
            }

            if ((startDate && listDate) && (startDate > listDate)) {
                break;
            }
            if (isStart) {
                const cards: ITrelloCardData[] = list.cards || (await this.trello.getCards(list.id));
                for (const card of cards) {
                    for (const label of card.labels) {
                        if (['green', 'blue', 'red', 'yellow'].includes(label.color)) {
                            res[label.color] += 1;
                            if (options && options.isSaveOnServer) {
                                // todo Продумать корректное поведение.
                                // Если не удалось получить дату, а метки есть, они уходят в никуда...
                                // Временное решение - смотреть на предыдущую дату если текущую определить не удалось.
                                let tmpListDate = listDate;
                                if (!tmpListDate) {
                                    tmpListDate = oldListDate;
                                }

                                if (tmpListDate) {
                                    let listDateYear = serverApiData.data[tmpListDate.getFullYear()];
                                    if (!listDateYear) {
                                        listDateYear = {};
                                    }

                                    let listDateMonth = listDateYear[tmpListDate.getMonth()];
                                    if (!listDateMonth) {
                                        listDateMonth = {};
                                    }

                                    if (!listDateMonth[tmpListDate.getDate()]) {
                                        listDateMonth[tmpListDate.getDate()] = {
                                            red: 0,
                                            blue: 0,
                                            yellow: 0,
                                            green: 0
                                        };
                                    }
                                    listDateMonth[tmpListDate.getDate()][label.color] += 1;

                                    listDateYear[tmpListDate.getMonth()] = listDateMonth;
                                    serverApiData.data[tmpListDate.getFullYear()] = listDateYear;
                                }
                                tmpListDate = null;
                            }
                        }
                    }
                }
            }

            if (list.name === startValue || ((startDate && listDate) && utils.isEqualDate(startDate, listDate))) {
                break;
            }
            oldListDate = listDate;
        }

        if (options && options.isSaveOnServer && res) {
            const serverApi = new ServerApi();
            serverApiData.name = options.boardName;
            serverApiData.orgName = utils.getLocalStorage('org_name') || Trebis.ORG_NAME;
            await serverApi.save(serverApiData);
            serverApiData = null;
        }

        return res;
    }

    private _logs(error: string): void {
        console.warn(error);
        TrelloUI.errorNotification('Trebis.' + error);
    }
}
