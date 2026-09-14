<?php

declare(strict_types=1);

namespace HomeEdu;

/** Учебный маршрут по КТП английского языка 4 класса на 2026/27 учебный год. */
final class Grade4EnglishContent
{
    /** @return array<int,array<string,mixed>> */
    public static function sections(): array
    {
        return array_map(
            static fn(array $section): array => [
                'title' => $section['title'],
                'description' => $section['description'],
                'topics' => array_map(
                    static fn(string $title): array => self::topic($title, $section),
                    $section['topics'],
                ),
            ],
            self::source(),
        );
    }

    /** @param array<string,mixed> $section @return array<string,mixed> */
    private static function topic(string $title, array $section): array
    {
        $rule = "Тема «{$title}». {$section['rule']}";
        $example = "Практический пример: {$section['example']} Прочитай фразу вслух, затем составь по образцу свою.";

        return [
            'title' => $title,
            'description' => 'Коротко изучаем новую лексику и грамматику, затем применяем их в устной и письменной речи.',
            'competencies' => ["Понимает и применяет материал темы «{$title}»"],
            'lessons' => [[
                'title' => $title,
                'summary' => "$rule Раздел рассчитан на {$section['hours']} рекомендованных академических часов.",
                'blocks' => [$rule, $example],
                'quiz' => [
                    'prompt' => $section['question'],
                    'type' => 'single_choice',
                    'options' => $section['options'],
                    'answer' => ['options' => [$section['correct']]],
                    'explanation' => $section['explanation'],
                ],
            ]],
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private static function source(): array
    {
        return [
            self::section(
                'Family and friend — Семья и друзья', 9,
                'Учимся описывать людей, предметы и действия. Have got сообщает о принадлежности, can — об умении, а Present Continuous — о действии прямо сейчас.',
                'She has got blue eyes. She can sing. She is reading now. — У неё голубые глаза. Она умеет петь. Сейчас она читает.',
                'Выбери правильный перевод фразы «Сейчас Том играет».',
                ['Tom plays now.', 'Tom is playing now.', 'Tom can playing now.'], 1,
                'Для действия, которое происходит сейчас, используется am/is/are + глагол с -ing.',
                ['Вводный урок. Знакомство с учебником', 'Одна большая счастливая семья', 'Мои лучшие друзья', 'Звуки', 'Златовласка и три медведя', 'Англоговорящие страны'],
            ),
            self::section(
                'A working day — Рабочий день', 8,
                'Говорим о местах, профессиях и распорядке дня. Have to означает необходимость: I have to get up early — мне нужно рано вставать.',
                'My mum is a doctor. She works at a hospital. I have to do my homework after school.',
                'Как сказать «Мне нужно идти в школу»?',
                ['I have to go to school.', 'I can to go to school.', 'I am go to school.'], 0,
                'После have to используется начальная форма глагола: have to go.',
                ['Места для посещений', 'Работай и играй', 'Работа', 'Златовласка и три медведя. Песня', 'Один день из моей жизни'],
            ),
            self::section(
                'Tasty treats — Вкусные угощения', 9,
                'Учимся говорить о еде, количестве, покупке и цене. Much употребляется с неисчисляемыми, many — с исчисляемыми словами, a lot of подходит в обоих случаях; may выражает разрешение.',
                'How many apples do we need? We need a lot of apples. May I have some juice, please?',
                'Выбери правильный вопрос.',
                ['How much apples?', 'How many apples?', 'How many milk?'], 1,
                'Apples можно посчитать, поэтому используется many.',
                ['Фрукты', 'Приготовление обеда', 'Что на полке?', 'Златовласка и три медведя. Песня', 'Десерты'],
            ),
            self::section(
                'At the zoo — В зоопарке', 8,
                'Описываем животных, их обычные и текущие действия, сравниваем и формулируем правила. Present Simple — привычка, Present Continuous — действие сейчас; must/mustn’t — обязательное правило или запрет.',
                'Monkeys climb trees. Look! The monkey is eating. You mustn’t feed the animals.',
                'Какое предложение означает запрет кормить животных?',
                ['You must feed the animals.', 'You mustn’t feed the animals.', 'You are feeding the animals.'], 1,
                'Mustn’t обозначает строгий запрет.',
                ['Забавные животные', 'Без ума от животных', 'Правила в зоопарке', 'Различные животные', 'Златовласка и три медведя. Песня', 'Прогулка среди дикой природы'],
            ),
            self::section(
                'Where were you yesterday? — Где ты был вчера?', 9,
                'Рассказываем, где кто-то был и что чувствовал. Was употребляется с I/he/she/it, were — с you/we/they; there was/there were сообщает, что что-то находилось в определённом месте.',
                'Yesterday I was at home. My friends were at the park. There were five children there.',
                'Выбери правильную форму: “They ___ happy yesterday.”',
                ['was', 'were', 'are'], 1,
                'С местоимением they в прошедшем времени используется were.',
                ['Порядковые числительные', 'Чувства и эмоции', 'Что случилось?', 'Златовласка и три медведя. Песня', 'Пожелание на день рождения'],
            ),
            self::section(
                'Tell the tale — Расскажи историю', 9,
                'Учимся пересказывать истории в Past Simple. У правильных глаголов форма прошедшего времени обычно образуется окончанием -ed; события связывают слова first, then, after that, finally.',
                'First the hare started quickly. Then he stopped. Finally the tortoise finished the race.',
                'Как образовать Past Simple от play?',
                ['played', 'plaied', 'playd'], 0,
                'К правильному глаголу play добавляется окончание -ed: played.',
                ['Рассказ про зайца и черепаху', 'Жили-были!', 'Числительные', 'Златовласка и три медведя. Песня', 'История с рифмой'],
            ),
            self::section(
                'Days to remember — Дни, чтобы помнить', 8,
                'Рассказываем о памятных событиях и действиях в прошлом. Неправильные глаголы имеют особую форму Past Simple, которую нужно запоминать: go — went, see — saw, have — had.',
                'We went to a concert and saw our favourite singer. I had a wonderful time.',
                'Выбери Past Simple от go.',
                ['goed', 'went', 'gone'], 1,
                'Неправильная форма прошедшего времени глагола go — went.',
                ['Лучшее время!', 'Волшебные моменты', 'Музыкальные инструменты', 'Златовласка и три медведя. Песня', 'Башня Элтон'],
            ),
            self::section(
                'Places to go — Места для посещений', 8,
                'Говорим о странах, одежде и планах на каникулы. Be going to выражает подготовленный план, will — решение, обещание или предположение о будущем.',
                'We are going to visit Florida. I will take my summer hat. It will be sunny.',
                'Как сказать о запланированной поездке: «Мы собираемся посетить Лондон»?',
                ['We are going to visit London.', 'We visited London.', 'We visiting London.'], 0,
                'Для заранее намеченного плана используется be going to + глагол.',
                ['Страны мира', 'Предметы одежды на лето', 'Страны и костюмы', 'Златовласка и три медведя. Песня', 'Флорида'],
            ),
        ];
    }

    /** @param array<int,string> $topics @return array<string,mixed> */
    private static function section(
        string $title,
        int $hours,
        string $rule,
        string $example,
        string $question,
        array $options,
        int $correct,
        string $explanation,
        array $topics,
    ): array {
        return compact('title', 'hours', 'rule', 'example', 'question', 'options', 'correct', 'explanation', 'topics') + [
            'description' => "$hours рекомендованных академических часов. Лексика, грамматика, чтение, аудирование и разговорная практика.",
        ];
    }
}
