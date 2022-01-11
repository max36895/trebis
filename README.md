TreBis
------
Расширение для браузера, упрощающее взаимодействие с trello.
Расширение позволяет:
 * В автоматическом режиме создавать список, прикрепляя к нему не выполненные за предыдущий день задачи. Метки при этом расставляются.
 * Смотреть статистику по выполнению задач
 * Смотреть общую статистику
 * Удалять старые карточки (кнопка доступна только администраторам)
 
## Установка
Расширение доступно по следующей ссылке: [https://chrome.google.com/webstore/detail/trebis/nhmenioinihecagcdbdmlmocmkoanoko/related?hl=ru&authuser=0](https://chrome.google.com/webstore/detail/trebis/nhmenioinihecagcdbdmlmocmkoanoko/related?hl=ru&authuser=0)

Также можно выкачать расширение из репозитория:
```bash
git clone https://github.com/max36895/trebis.git
```
Установить зависимости: 
```bash
npm i
```
Собрать в dev режиме:
```bash
npm run dev
```
или

Собрать в prod режиме:
```bash
npm run build
```
После чего добавить расширение вручную в браузер.
Для добавления расширения в магазин гугл, нужно перейти на страницу [регистрации](https://chrome.google.com/webstore/devconsole/register)
