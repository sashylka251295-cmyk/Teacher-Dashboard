# Student Progress Tracker

Базовый каркас первого модуля будущей Teacher Platform. Проект использует обычные HTML/CSS/JavaScript-модули, Firebase Authentication и Cloud Firestore и не требует собственного backend или этапа сборки.

## Текущее состояние

Сейчас подготовлены:

- точки входа `index.html`, `login.html`, `admin.html` и `student.html`;
- единая инициализация Firebase;
- базовый вход, выход и проверка ролей `admin` / `student`;
- раздельный слой доступа к существующим Firestore-коллекциям;
- доменные константы, расчёт прогресса и базовая валидация;
- Firestore Security Rules и индекс для сортировки units;
- пустые каталоги для будущих assets и CSS-файлы без визуального оформления.

CRUD-интерфейсы, progress matrix, карточки, модальные окна и финальные стили пока не реализованы. Мок-данных в проекте нет: источником прикладных данных должен быть только Firestore.

## Настройка Firebase

1. Откройте настройки Web App в Firebase Console.
2. Перенесите frontend-конфигурацию в `js/firebase-config.js`, заменив все значения `REPLACE_WITH_*`.
3. Убедитесь, что включён способ входа Email/Password.
4. Убедитесь, что для существующего администратора есть документ `users/{uid}` с полем `role: "admin"`.
5. Перед публикацией проверьте и разверните `firestore.rules`.

Frontend Firebase configuration не является service-account ключом. Никогда не добавляйте в проект Admin SDK private key, service account JSON или пароли.

## Локальный запуск

ES-модули нужно открывать через HTTP-сервер, а не напрямую с диска. Например:

```powershell
python -m http.server 8080
```

После этого откройте `http://localhost:8080`.

## Структура

```text
assets/                 будущие иконки, изображения и аватары
css/                    будущие общие/admin/student стили
js/
  auth/                 Authentication и route guards
  core/                 Firebase client, навигация, DOM helpers
  data/                 имена коллекций и repositories
  domain/               правила предметной области и validation
  pages/                entry modules HTML-страниц
firestore.rules         серверные правила доступа к Firestore
firestore.indexes.json  необходимые составные индексы
firebase.json           конфигурация Firebase CLI
```

Проект не использует абсолютные локальные пути и готов к публикации из корня репозитория через GitHub Pages.

