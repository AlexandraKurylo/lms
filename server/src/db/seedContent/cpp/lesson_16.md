# Урок 16. Файл замість SQL: свій міні-CRUD

## Пролог: коли SQL — це занадто

Уяви, що тобі потрібно зберегти 200 слів санскриту між запусками програми. Перша думка — база даних. Друга — SQLite, це всього одна бібліотека. Третя — а може, просто текстовий файл? Для 200 записів — так, може. І навіть краще: не тягнеш залежність, не вчиш SQL, бачиш свої дані очима (відкрив у Блокноті — і все зрозуміло). Для навчального проекту — ідеально.

**CRUD** — це абревіатура чотирьох операцій над даними: **C**reate (створити), **R**ead (прочитати), **U**pdate (оновити), **D**elete (видалити). Будь-яка база даних — це інструмент для CRUD. Текстовий файл — теж. Просто інструмент простіший.

## Формати файлів: CSV, JSON, власний

Перш ніж писати код, потрібно вирішити, **як саме** зберігати дані. Варіанти:

**CSV (Comma-Separated Values)** — найпростіший. Кожен рядок — один запис, поля розділені комами. `dharma,धर्म,закон,2`. Люди читають, Excel розуміє. Мінус: що якщо в полі є кома? Тоді лапки, екран-послідовності... починається біль.

**JSON** — структурований, підтримує вкладені об'єкти, масиви, типи. `"word": {"devanagari": "धर्म", "transliteration": "dharma", "translation": "закон"}`. Стандарт де-факто для обміну даними. Бібліотеки для парсингу — всюди.

**Власний бінарний формат** — компактний, швидкий, але тільки для програми. Ти не зможеш відкрити його в Excel.

**XML** — старший брат JSON. Більш багатослівний, але й більш формальний. У нових проектах зазвичай уникають.

Для нашого SAMSKRTA візьмемо JSON — найпоширеніший, зручний для людини, добре підтримується. У Qt є `QJsonDocument`, у C++ — бібліотеки `nlohmann/json` (найпопулярніша) або стандартний парсер у Qt. Бібліотека `nlohmann/json` настільки зручна, що використовується в багатьох продакшн-проектах.

## Код уроку

`WordRepository` нижче — це `src/data/WordRepository.h`, і `Word` тут — канонічний, з `src/domain/Word.h` (уроки 8 і 9), без жодного локального переозначення. Наприкінці уроку побачимо, як цей репозиторій підключається до `Database` з уроку 9 — той сам більше не забуватиме слова після перезапуску.

```cpp
// src/data/WordRepository.h
// Словник, що переживає перезапуск програми: CRUD над файлом JSON.
// Заголовок. Сам по собі не збирається — його підключають інші файли.
//
// Потребує: #include <nlohmann/json.hpp>
// Встанови: vcpkg install nlohmann-json
//      або: apt install nlohmann-json3-dev (Linux)
//      або: brew install nlohmann-json (macOS)
#pragma once

#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <optional>
#include <algorithm>
#include <filesystem>
#include <nlohmann/json.hpp>
#include "../domain/Word.h"

using json = nlohmann::json;

// ===== Серіалізація: Word <-> JSON =====
// inline — з тієї самої причини, що й у Word.h з уроку 8: тіло функції
// лежить у заголовку, і без inline лінкер побачить дублікат.
inline json wordToJson(const Word& w) {
    return json{
        {"id", w.id},
        {"devanagari", w.devanagari},
        {"transliteration", w.transliteration},
        {"translation", w.translation},
        {"difficultyLevel", w.difficultyLevel},
        {"timesReviewed", w.timesReviewed},
        {"isKnown", w.isKnown}
    };
}

inline Word wordFromJson(const json& j) {
    Word w;
    w.id = j.value("id", 0);
    w.devanagari = j.value("devanagari", "");
    w.transliteration = j.value("transliteration", "");
    w.translation = j.value("translation", "");
    w.difficultyLevel = j.value("difficultyLevel", 1);
    w.timesReviewed = j.value("timesReviewed", 0);
    w.isKnown = j.value("isKnown", false);
    return w;
}

// ===== Repository: CRUD над файлом =====
class WordRepository {
    std::filesystem::path m_path;
    std::vector<Word> m_words;
    int m_nextId = 1;

public:
    explicit WordRepository(const std::filesystem::path& path)
        : m_path(path) {
        load();
    }

    // R: прочитати все
    std::vector<Word> all() const { return m_words; }

    // R: знайти за id
    std::optional<Word> findById(int id) const {
        for (const auto& w : m_words) {
            if (w.id == id) return w;
        }
        return std::nullopt;
    }

    // R: знайти за транслітерацією
    std::optional<Word> findByTranslit(const std::string& t) const {
        for (const auto& w : m_words) {
            if (w.transliteration == t) return w;
        }
        return std::nullopt;
    }

    // C: створити
    Word create(std::string dev, std::string tr, std::string t, int diff) {
        Word w(std::move(dev), std::move(tr), std::move(t), diff);
        w.id = m_nextId++;
        m_words.push_back(w);
        save();
        return w;
    }

    // U: оновити за id
    bool update(int id, const Word& updated) {
        for (auto& w : m_words) {
            if (w.id == id) {
                w = updated;
                w.id = id;  // зберігаємо id
                save();
                return true;
            }
        }
        return false;
    }

    // D: видалити за id
    bool remove(int id) {
        auto it = std::remove_if(m_words.begin(), m_words.end(),
            [id](const Word& w) { return w.id == id; });
        if (it != m_words.end()) {
            m_words.erase(it, m_words.end());
            save();
            return true;
        }
        return false;
    }

    size_t count() const { return m_words.size(); }

private:
    void load() {
        if (!std::filesystem::exists(m_path)) {
            std::cout << "[load] файл не існує, починаємо з порожнього сховища\n";
            return;
        }
        std::ifstream in(m_path);
        if (!in) {
            std::cerr << "[load] не вдалося відкрити " << m_path << "\n";
            return;
        }
        try {
            json j;
            in >> j;
            for (const auto& item : j["words"]) {
                m_words.push_back(wordFromJson(item));
            }
            if (!m_words.empty()) {
                m_nextId = m_words.back().id + 1;
            }
            std::cout << "[load] завантажено " << m_words.size() << " слів\n";
        } catch (const json::parse_error& e) {
            std::cerr << "[load] помилка парсингу: " << e.what() << "\n";
        }
    }

    void save() const {
        json j;
        j["version"] = 1;
        j["words"] = json::array();
        for (const auto& w : m_words) {
            j["words"].push_back(wordToJson(w));
        }

        // Атомарний запис: пишемо в тимчасовий файл, потім перейменовуємо
        auto tempPath = m_path;
        tempPath += ".tmp";

        std::ofstream out(tempPath);
        if (!out) {
            std::cerr << "[save] не вдалося відкрити " << tempPath << "\n";
            return;
        }
        out << j.dump(2);  // 2 — відступ для читабельності
        out.close();

        std::filesystem::rename(tempPath, m_path);
    }
};

```

І знову, як в уроках 8 і 9, заголовок на цьому закінчується — `main` у ньому немає. Демонстрація живе у вправі `exercises/ex16_repository.cpp`:

```cpp
// exercises/ex16_repository.cpp
// Повний цикл CRUD над файлом. Запусти двічі — і побачиш різницю.

#include <iostream>
#include <fstream>
#include "../src/data/WordRepository.h"

int main() {
    WordRepository repo("data/dictionary.json");

    // C: створити — тільки якщо сховище порожнє
    if (repo.count() == 0) {
        std::cout << "\n[C] створюємо початковий набір\n";
        repo.create("धर्म", "dharma", "закон, обов'язок", 2);
        repo.create("सत्य", "satya", "істина", 1);
        repo.create("अहिंसा", "ahimsa", "ненасильство", 4);
        repo.create("कर्म", "karma", "дія, вчинок", 3);
    } else {
        std::cout << "\n[C] пропускаємо: у сховищі вже є слова\n";
    }

    // R: прочитати
    std::cout << "\n[R] читаємо все (" << repo.count() << "):\n";
    for (const auto& w : repo.all()) {
        std::cout << "  [" << w.id << "] " << w.devanagari
                  << " (" << w.transliteration << ") — "
                  << w.translation << " [рівень " << w.difficultyLevel << "]\n";
    }

    // U: оновити
    if (auto w = repo.findByTranslit("dharma")) {
        std::cout << "\n[U] оновлюємо \"" << w->transliteration << "\"\n";
        Word updated = *w;
        updated.translation = "закон, обов'язок, істина";
        updated.difficultyLevel = 3;
        repo.update(w->id, updated);
    }

    // D: видалити
    if (auto w = repo.findByTranslit("karma")) {
        std::cout << "\n[D] видаляємо \"" << w->transliteration << "\"\n";
        repo.remove(w->id);
    } else {
        std::cout << "\n[D] \"karma\" уже видалено раніше\n";
    }

    std::cout << "\n[R] фінальний стан (" << repo.count() << "):\n";
    for (const auto& w : repo.all()) {
        std::cout << "  [" << w.id << "] " << w.devanagari
                  << " (" << w.transliteration << ") — "
                  << w.translation << "\n";
    }

    // Показуємо початок файлу, який лежить на диску
    std::cout << "\nПерші рядки data/dictionary.json:\n";
    std::ifstream in("data/dictionary.json");
    std::string line;
    for (int i = 0; i < 12 && std::getline(in, line); ++i) {
        std::cout << "  " << line << "\n";
    }

    return 0;
}
```

Найважливіше в цьому уроці не видно з одного запуску — потрібні два. **Перший**, коли файлу ще немає:

```
[load] файл не існує, починаємо з порожнього сховища

[C] створюємо початковий набір

[R] читаємо все (4):
  [1] धर्म (dharma) — закон, обов'язок [рівень 2]
  [2] सत्य (satya) — істина [рівень 1]
  [3] अहिंसा (ahimsa) — ненасильство [рівень 4]
  [4] कर्म (karma) — дія, вчинок [рівень 3]

[U] оновлюємо "dharma"

[D] видаляємо "karma"

[R] фінальний стан (3):
  [1] धर्म (dharma) — закон, обов'язок, істина
  [2] सत्य (satya) — істина
  [3] अहिंसा (ahimsa) — ненасильство

Перші рядки data/dictionary.json:
  {
    "version": 1,
    "words": [
      {
        "devanagari": "धर्म",
        "difficultyLevel": 3,
        "id": 1,
        "isKnown": false,
        "timesReviewed": 0,
        "translation": "закон, обов'язок, істина",
        "transliteration": "dharma"
      },
```

**Другий запуск, одразу після першого**, нічого не змінюючи:

```
[load] завантажено слів: 3

[C] пропускаємо: у сховищі вже є слова

[R] читаємо все (3):
  [1] धर्म (dharma) — закон, обов'язок, істина [рівень 3]
  [2] सत्य (satya) — істина [рівень 1]
  [3] अहिंसा (ahimsa) — ненасильство [рівень 4]

[D] "karma" уже видалено раніше
```

Ось воно. Програма завершилася, уся оперативна пам'ять повернулася системі, усі об'єкти знищилися — а словник **лишився**. Причому лишився саме таким, яким ми його залишили: `dharma` із оновленим перекладом і рівнем 3, `karma` видалене назавжди. Дев'ятнадцять уроків усе, що ми будували, зникало разом із процесом; починаючи з цього — ні.

Зверни увагу й на дрібницю, яка виявиться важливою: у файлі деванагарі записане **як є**, а не як `धर...`. Бібліотека зберігає UTF-8 напряму, тому файл можна відкрити звичайним редактором і прочитати очима. Формат, у який не можна зазирнути без спеціального інструменту, дуже ускладнює життя, коли щось пішло не так.

І ще одне, чого не видно у виводі взагалі: після роботи програми в теці `data/` лежить **тільки** `dictionary.json`. Файлу `dictionary.json.tmp` немає — він з'явився й зник під час запису. Саме так і має працювати атомарний запис.

Розберемо, що тут відбувається.

**`std::filesystem`** — стандартна бібліотека C++17 для роботи з файловою системою. `std::filesystem::path` — крос-платформний шлях, `exists()`, `rename()`. До C++17 треба було використовувати платформо-залежні API: `access()`, `rename()` з `<cstdio>` на Unix, `MoveFileEx` на Windows. Тепер все одне й те саме.

**Атомарний запис через тимчасовий файл** — критично для надійності. Якщо ти пишеш прямо у файл, і в цей момент вимкнули світло (або програма впала), файл буде пошкоджено. Якщо пишеш у `dictionary.json.tmp`, а потім `rename` — заміна відбувається атомарно на рівні файлової системи. Або старий файл, або новий, проміжного стану немає. Це базова практика, про яку часто забувають.

**`std::optional<Word>`** — пам'ятаєш з уроку 8? Замість магічного `-1` як ідентифікатора «не знайдено» — `nullopt`. Типобезпечно, зрозуміло, без сюрпризів.

**`std::remove_if` + `erase`** — класична ідіома видалення з вектора за умовою. `remove_if` переміщує всі «не видалені» елементи в початок, повертає ітератор на новий «кінець». `erase` фізично видаляє все після цього ітератора. Це називають «erase-remove idiom», і це найшвидший спосіб видалити елементи з вектора за умовою.

**`json::array()`, `json::object()`** — конструктори для двох основних типів JSON: масиву і словника. `j["words"] = json::array()` створює порожній масив, до якого ми додаємо елементи через `push_back`. У nlohmann::json це виглядає як звичайний C++ контейнер.

**`in >> j`** — магія операторів. Оператор `>>` у `nlohmann::json` перевантажений для читання з потоку. Те саме з `<<` для запису. Це одна з тих речей, які роблять бібліотеку приємною у використанні — не треба пам'ятати десяток функцій парсингу, просто читаєш з потоку.

**`j.dump(2)`** — серіалізація JSON у рядок. Параметр `2` — відступ у 2 пробіли для читабельності. Без параметра — компактний JSON у один рядок. У реальному проекті пиши з відступами під час розробки (зручно читати) і компактно у продакшні (економія місця).

## Підключаємо репозиторій до Database

Демо вище показало `WordRepository` саму по собі — корисно, щоб побачити чистий CRUD без сторонніх деталей. Але справжня мета — позбавити `Database` з уроку 9 від головного недоліку: перезапустив програму, і всі слова, додані через `addWord`, зникали, бо жили лише в оперативній пам'яті. Виправляємо це, не чіпаючи публічний інтерфейс `Database::instance()`, яким уже користується `WordCard` з уроку 10:

```cpp
// доповнення до Database з уроку 9 — синглтон тепер переживає перезапуск
private:
    WordRepository m_repo{"dictionary.json"};

public:
    Database() {
        for (const auto& w : m_repo.all()) {
            m_words.push_back(w);
            m_byTranslit[w.transliteration] = m_words.size() - 1;
            m_nextId = std::max(m_nextId, w.id);
        }
        std::cout << "[Database] завантажено " << m_words.size() << " слів із диска\n";
    }

    void addWord(Word word) {
        std::lock_guard<std::mutex> lock(m_mutex);
        word = m_repo.create(word.devanagari, word.transliteration,
                              word.translation, word.difficultyLevel);
        m_byTranslit[word.transliteration] = m_words.size();
        m_words.push_back(std::move(word));
    }
```

`Database` тепер при народженні читає те, що `WordRepository` встиг зберегти минулого разу, а `addWord` замість того, щоб просто дописати у вектор у пам'яті, віддає створення `WordRepository::create()` — той сам призначить `id` і одразу атомарно збереже файл. Синглтон лишається синглтоном, індекс за транслітерацією з уроку 15 лишається на місці — просто під капотом з'явився диск, а не тільки оперативна пам'ять.

## Де це вже так влаштовано

**VSCode** зберігає свої налаштування в JSON. Кожна конфігурація — це валідний JSON, який можна відкрити в текстовому редакторі, відредагувати, закомитити в git. Це, по суті, наш підхід — простий, зрозумілий, контрольований.

**Mozilla Firefox** зберігає закладки в JSON (`places.sqlite` теж є, але bookmarks — JSON). Історично — HTML, потім перейшли на JSON для зручності парсингу. SQLite залишили для великих структур (історія, кеш).

**Discord** зберігає конфігурацію користувача в JSON. Проста структура, простий формат, легко мігрувати. Усе, що не вимагає запитів і транзакцій — JSON.

**Чому все ж SQLite, а не JSON** — коли дані стають складними (зв'язки між таблицями, індекси, запити по декількох полях одночасно, транзакції), JSON перестає вистачати. SQLite дає тобі SQL — мову запитів, оптимізатор, транзакції. Для нашого SAMSKRTA з 200 словами JSON — норм. Для словника на 10 000 слів з пошуком, фільтрами, історією переглядів — вже SQLite. У наступних уроках ми дійдемо і до цього.

**Аналогія з блокнотом**: файл JSON — це твій особистий блокнот. Ти сам вирішуєш, як його структурувати, сам пишеш, сам читаєш. SQLite — це бібліотечний каталог із бібліотекарем, який швидко знаходить потрібне за складними запитами. Для домашнього блокнота бібліотекар не потрібен. Для міської бібліотеки — без нього не обійтися.

## Куди це веде далі

**Замість `nlohmann/json`** у Qt-проектах — `QJsonDocument` (вбудована):

```cpp
QJsonObject wordToJson(const Word& w) {
    QJsonObject obj;
    obj["devanagari"] = w.devanagari;
    obj["transliteration"] = w.transliteration;
    return obj;
}
```

**Замість JSON** — Protocol Buffers, MessagePack, CBOR. Бінарні формати, швидші, компактніші, але не читабельні для людини. Використовуються, коли продуктивність важливіша за зручність.

**Замість файлу** — SQLite (`sqlite3` — частина стандартної бібліотеки на більшості систем):

```cpp
#include <sqlite3.h>
// ... відкриваємо, виконуємо SQL-запити ...
```

SQLite — це «вбудована СУБД», яка живе в одному файлі (`.db`) і не потребує окремого сервера. Для наступного уроку — гарний кандидат.

**Замість атомарного запису через `.tmp` + `rename`** — бібліотеки типу `std::ofstream` із RAII-обгортками, або спеціалізовані бібліотеки на кшталт `Boost.AFS` (atomic file save).

## Питання для самоперевірки

1. Запусти програму кілька разів. Щоразу додаються ті самі слова чи ні? Чому?
2. Відкрий `dictionary.json` у текстовому редакторі. Зрозуміла структура? Додай слово вручну, запусти програму — чи побачить вона твоє слово?
3. Видали `dictionary.json`. Запусти програму. Що станеться?
4. Додай у `WordRepository` метод `std::vector<Word> findByDifficulty(int maxLevel)`. Збережи файл, перезапусти, перевір, що метод працює.
5. Спробуй зламати JSON: додай зайву кому вручну у файлі. Що скаже програма при старті? Де обробка помилки?

---

**На наступному уроці**: багатопотоковість. Коли один потік добре, а два — квест із гонками, дедлоками і сірою волоссям. Дізнаємося, як `std::thread` і `std::mutex` рятують від хаосу, і чому Qt має свій `QThread`.
