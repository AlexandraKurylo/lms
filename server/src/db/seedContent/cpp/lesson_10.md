# Урок 10. Спадкування vs композиція: будуємо свій віджет

## Класичне питання співбесіди

Кожен, хто ходив на співбесіду з C++, чув це питання: «Коли використовувати спадкування, а коли — композицію?» І кожен чув відповідь: «Спадкування — для відношення "є-щось" (is-a), композиція — для відношення "має-щось" (has-a)». Це правильно, але марно, якщо не розумієш, що за цим стоїть.

Сьогодні ми розберемося на прикладі нашого тренажера. Нам потрібна «картка слова» — віджет, що показує одне слово з йогоньою транслітерацією, перекладом і кнопками. Це, здавалося б, простий `QWidget`, але насправді тут є над чим подумати. Як зробити так, щоб картка була гнучкою, щоб її можна було використати в різних контекстах (у режимі вивчення, у режимі повторення, у режимі статистики), і при цьому не перетворити код на спадковий монстра з десятьма рівнями `class MegaMegaWidget`.

## Спадкування: "є-щось"

```cpp
class WordCard : public QWidget {  // WordCard Є QWidget
    // ...
};
```

`WordCard` успадковує все, що вміє `QWidget`: показувати себе на екрані, приймати події мишки, змінювати розмір, мати лейаут. Це класичне спадкування: «картка слова **є** віджетом». Користувач може зробити `QWidget* w = new WordCard(...);` — і це спрацює, бо `WordCard` обіцяє вести себе як `QWidget`. Цей принцип називається **Liskov Substitution Principle** — об'єкти дочірнього класу можна використовувати скрізь, де очікуються об'єкти батьківського.

## Композиція: "має-щось"

```cpp
class WordCard {
    QLabel  m_devanagari;   // WordCard МАЄ лейбл
    QLabel  m_translation;
    QPushButton m_knownButton;
};
```

`WordCard` **складається з** інших віджетів: лейблів, кнопок, лейаутів. Він не успадковує `QWidget`, а використовує Qt-ий спосіб «контейнерів» — сам по собі `WordCard` може бути не віджетом, а просто класом-композицією, що володіє іншими віджетами.

## Коли що

**Спадкування** — коли дочірній клас **дійсно є** різновидом батьківського і **замінює його без застережень**. `QPushButton` — це `QWidget` (можна використати скрізь, де потрібен віджет). `QLabel` — це `QWidget`. Все це спадкування, і воно правильне.

**Композиція** — коли хочеш використати функціонал іншого класу, але не хочеш обіцяти «я є ним». Наприклад, `Car` має `Engine` (композиція), але `Car` не є `Engine`. `Student` має `Name` (композиція), але `Student` не є `Name`. У нашому випадку: `WordCard` має `QLabel` для деванагарі, але `WordCard` не є `QLabel`.

## Код уроку: WordCard двома способами

`Word` тут — той самий, канонічний, з `src/domain/Word.h` (урок 8), не вигаданий заново. Його поля — `std::string`, а Qt хоче `QString` для лейблів, тож у конструкторі буде явне перетворення `QString::fromStdString(...)` — дрібниця, але саме так на практиці стикуються доменна модель і UI-шар у реальному Qt-проєкті.

### Спосіб 1: спадкування (Qt-ий, ідіоматичний) — це `src/ui/WordCard.h`

```cpp
// src/ui/WordCard.h
// Картка одного слова: те, що користувач бачить під час повторення.
// Заголовок. Сам по собі не збирається — його підключають інші файли.
#pragma once

#include <QWidget>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QString>
#include "../domain/Word.h"

// WordCard Є QWidget
class WordCard : public QWidget {
public:
    explicit WordCard(const Word& word, QWidget* parent = nullptr)
        : QWidget(parent), m_word(word) {

        // Складові частини — лейбли і кнопка
        m_devanagariLabel = new QLabel(QString::fromStdString(word.devanagari));
        m_devanagariLabel->setStyleSheet("font-size: 48px;");

        m_translitLabel = new QLabel(QString::fromStdString(word.transliteration));
        m_translitLabel->setStyleSheet("font-style: italic; color: gray;");

        m_translationLabel = new QLabel(QString::fromStdString(word.translation));
        m_translationLabel->setWordWrap(true);

        m_knownButton = new QPushButton("Знаю");
        m_unknownButton = new QPushButton("Забув");

        auto* buttonRow = new QHBoxLayout;
        buttonRow->addWidget(m_knownButton);
        buttonRow->addWidget(m_unknownButton);

        auto* mainLayout = new QVBoxLayout(this);
        mainLayout->addWidget(m_devanagariLabel);
        mainLayout->addWidget(m_translitLabel);
        mainLayout->addWidget(m_translationLabel);
        mainLayout->addLayout(buttonRow);

        setFixedSize(280, 200);
    }

    // Дочірній клас може додавати свої методи
    int wordId() const { return m_word.id; }

private:
    Word m_word;
    QLabel* m_devanagariLabel;
    QLabel* m_translitLabel;
    QLabel* m_translationLabel;
    QPushButton* m_knownButton;
    QPushButton* m_unknownButton;
};
```

І `src/main.cpp` (з уроку 7) тепер бере не хардкоджене вітання, а справжнє слово з `Database::instance()` (урок 9) і показує його карткою:

```cpp
// src/main.cpp
#include <QApplication>
#include <QWidget>
#include <QVBoxLayout>
#include "domain/Word.h"
#include "data/Database.h"
#include "ui/WordCard.h"

int main(int argc, char* argv[]) {
    QApplication app(argc, argv);

    auto& db = Database::instance();
    if (db.count() == 0) {
        db.addWord(Word("धर्म", "dharma", "закон, обов'язок", 2));
    }

    QWidget window;
    window.setWindowTitle("SAMSKRTA");
    auto* layout = new QVBoxLayout(&window);
    layout->addWidget(new WordCard(db.allWords().front(), &window));

    window.resize(320, 260);
    window.show();
    return app.exec();
}
```

### Спосіб 2: композиція (для порівняння, окремий приклад — не йде в проєкт)

```cpp
// WordCard НЕ є QWidget — він створює QWidget і наповнює його
class WordCard {
public:
    explicit WordCard(const Word& word) : m_widget(makeCard(word)) {}
    QWidget* widget() { return m_widget.get(); }

private:
    static std::unique_ptr<QWidget> makeCard(const Word& word) {
        auto root = std::make_unique<QWidget>();
        // ... те саме наповнення, як у способі 1 ...
        return root;
    }
    std::unique_ptr<QWidget> m_widget;
};
```

У Qt **спадкування майже завжди правильний вибір** для віджетів, бо Qt спроєктовано навколо поліморфізму: ти можеш покласти `WordCard*` у будь-який лейаут, де очікується `QWidget*`. Спосіб 2 у Qt — не ідіоматичний, хоча й можливий, і саме тому в наш проєкт іде спосіб 1.

Розберемо, що тут відбувається.

**`explicit` у конструкторі** — захищає від неявного перетворення. Без `explicit` компілятор міг би випадково перетворити `Word` на `WordCard` в одному аргументі. З `explicit` — тільки через явний `WordCard(word)`. Дрібниця, яка запобігає дивним багам. Запам'ятай: конструктори з одним аргументом — завжди `explicit`, якщо не впевнений, що хочеш неявне перетворення.

**`QWidget* parent = nullptr`** — Qt-ий патерн. Кожен віджет може мати «батька» — віджет, що його володіє. Коли батько знищується, всі діти теж. Це ціла система управління пам'яттю, вбудована в Qt. Якщо передаєш `nullptr` — віджет сам по собі і треба не забути його `delete`-нути. Якщо передаєш батька — Qt подбає про все.

**`setStyleSheet("font-size: 48px;")`** — спосіб стилізувати віджет через CSS-подібний синтаксис. Qt-ий підхід: відокремити зовнішній вигляд від логіки. Для прототипу — зручно, для великих проектів — зазвичай виносять у `.qss` файли. У нашому проекті ми використовуватимемо це помірно.

**`setWordWrap(true)`** — дозволяє тексту переноситися на новий рядок, якщо він не влазить. Без цього довгий переклад просто обріжеться або вилізе за межі віджета.

**`setFixedSize(280, 200)`** — фіксує розмір. У реальному проекті ти б не хотів цього, але для уроку — зручно, щоб вікно не стрибало.

## Де це вже так влаштовано

**Qt побудований на спадкуванні.** Вся ієрархія класів Qt — це дерево спадкування: `QObject` → `QWidget` → конкретні віджети (`QPushButton`, `QLabel`, `QListView`). `QLineEdit` успадковує `QWidget`, `QWidget` успадковує `QObject`. Усе, що ти бачиш у Qt Creator або в дизайнері форм — об'єкти цієї ієрархії.

**STL використовує композицію.** `std::vector` **не є** якимось контейнером — він **складається з** трьох вказівників (початок, кінець, кінець резерву). `std::list` — не успадковує `std::vector`, вони навіть не родичі. Вони обоє реалізують інтерфейс «контейнер» через композицію. Це дозволяє їм мати зовсім різну внутрішню структуру, але однаковий зовнішній вигляд.

**Unreal Engine** — складна суміш. Більшість ігрових об'єктів (`AActor`, `UObject`) — спадкування, бо в грі часто потрібно «оновити» базовий клас (`Tick()`, `BeginPlay()`). Але допоміжні речі на кшталт математичних векторів (`FVector`) — композиція, бо вектор не є спадкоємцем чогось.

**MVC (Model-View-Controller)** — класична архітектура, де View (представлення) — це спадкування віджетів, Model (модель даних) — це композиція простих класів, Controller — це щось середнє. У нашому SAMSKRTA `Word` — модель, `WordCard` — представлення, а логіка «яке слово показати наступним» — контролер. Це класичний поділ, який рятує від хаосу, коли проект росте.

**Аналогія з автомобілем**: спадкування — це ієрархія класів авто: `Car` → `Sedan`, `Car` → `SUV`, `SUV` → `LandRover`. Кожен `LandRover` є `SUV`, який є `Car`. Це справжнє відношення «є». Композиція — це «авто має двигун»: `Car` має `Engine`, але `Car` не є `Engine`. Ти не можеш сказати `Engine e = myCar;`, хоча в машині двигун справді є. Якщо в тебе питання «це справді спадкування чи просто використання?» — зазвичай відповідь «просто використання». Спадкування — це серйозне зобов'язання, і ставитися до нього треба серйозно.

## Куди це веде далі

**Композиція через інтерфейси (Strategy Pattern)** — коли хочеться гнучкості спадкування без жорсткості ієрархії:

```cpp
class IDisplayStrategy {
public:
    virtual ~IDisplayStrategy() = default;
    virtual void render(const Word& w) = 0;
};

class DevanagariLarge : public IDisplayStrategy { /* ... */ };
class TransliterationFirst : public IDisplayStrategy { /* ... */ };
class MinimalBlackOnWhite : public IDisplayStrategy { /* ... */ };

class WordCard {
    std::unique_ptr<IDisplayStrategy> m_strategy;
public:
    void setStrategy(std::unique_ptr<IDisplayStrategy> s) {
        m_strategy = std::move(s);
    }
    void show(const Word& w) { m_strategy->render(w); }
};
```

Тепер `WordCard` може показувати слово в різних стилях, не успадковуючи купу класів. Це класична композиція + поліморфізм = гнучкість.

**`std::variant` для станів картки** (C++17):
```cpp
std::variant<LearningState, ReviewState, KnownState> m_state;
```
Одна змінна, яка може бути одним із кількох типів. У нашому SAMSKRTA це буде в уроці про інтервальне повторення: кожне слово має стан (`New`, `Learning`, `Known`, `Lapsed`), і зручно зберігати це як `variant`.

## Питання для самоперевірки

1. Додай у `WordCard` ще один лейбл для прикладу вжичення. Де його розмістити в лейауті — над чи під перекладом? Чому?
2. Зміни `setFixedSize` на `setMinimumSize` і додай можливість розтягувати картку. Що зламається?
3. Створи другий клас `WordCardCompact`, який успадковує `WordCard` і ховає транслітерацію. Для чого це може бути корисно?
4. Поясни, чому `class Engine` всередині `class Car` — це композиція, а `class ElectricCar : public Car` — спадкування. Намалой обидві ситуації словами.
5. Додай у `WordCard` обробник натискання кнопки «Знаю»: при натисканні картка змінює колір фону на зелений. Підказка: `setStyleSheet`.

---

**На наступному уроці**: куди поділася змінна. Стек, купа, час життя, і чому `delete` — це не кнопка «помити посуд», а скоріше кнопка «викинути сміття в правий бак».
