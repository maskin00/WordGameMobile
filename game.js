// game.js - Мобильная версия с загрузкой файлов
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.life = 30;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 165, 0, ${this.life / 30})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Word {
    constructor(text, x, imgSrc) {
        this.text = text.toUpperCase();
        this.x = x;
        this.y = 0;
        this.speed = 0.3;
        this.imgSrc = imgSrc;
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onerror = () => {
            console.error(`Не удалось загрузить изображение: ${this.imgSrc}`);
            this.imageError = true;
        };
        this.image.onload = () => {
            console.log(`Изображение загружено: ${this.imgSrc}`);
            this.imageLoaded = true;
        };
        this.particles = [];
        this.exploding = false;
        this.imageError = false;
        this.imageLoaded = false;
    }

    update() {
        if (this.exploding) {
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.life > 0);
        } else {
            this.y += this.speed;
        }
    }

    draw(ctx, input) {
        if (this.exploding) {
            this.particles.forEach(p => p.draw(ctx));
            return;
        }

        const canvas = ctx.canvas;
        let scaledHeight = 0;
        
        // Отображение изображения или заглушки
        if (this.imageLoaded && !this.imageError && this.image.complete && this.image.naturalWidth !== 0) {
            const maxSize = Math.min(canvas.width * 0.25, 150);
            const width = this.image.width;
            const height = this.image.height;
            const scale = Math.min(maxSize / width, maxSize / height);
            const scaledWidth = width * scale;
            scaledHeight = height * scale;
            
            try {
                ctx.drawImage(this.image, this.x - scaledWidth / 2, this.y - scaledHeight / 2, scaledWidth, scaledHeight);
            } catch (e) {
                console.error('Ошибка отрисовки изображения:', e);
                this.drawPlaceholder(ctx, canvas, scaledHeight);
            }
        } else {
            scaledHeight = this.drawPlaceholder(ctx, canvas);
        }

        // Отображение текста
        this.drawText(ctx, input, canvas, scaledHeight);
    }

    drawPlaceholder(ctx, canvas, fallbackHeight = null) {
        const size = Math.min(canvas.width * 0.25, 100);
        ctx.fillStyle = 'lightgray';
        ctx.fillRect(this.x - size / 2, this.y - size / 2, size, size);
        ctx.fillStyle = 'black';
        ctx.font = `${size * 0.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', this.x, this.y + size * 0.1);
        return fallbackHeight || size;
    }

    drawText(ctx, input, canvas, scaledHeight) {
        // Отображение текста с учетом размера экрана
        const fontSize = Math.max(16, Math.min(canvas.width * 0.03, 25));
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        
        const inputUpper = input.toUpperCase();
        let matchedLength = 0;
        
        // Определяем количество совпадающих символов
        for (let i = 0; i < inputUpper.length && i < this.text.length; i++) {
            if (inputUpper[i] === this.text[i]) {
                matchedLength++;
            } else {
                break;
            }
        }
        
        const textY = this.y + scaledHeight / 2 + fontSize + 10;
        
        // Отображаем текст по буквам
        for (let i = 0; i < this.text.length; i++) {
            ctx.fillStyle = i < matchedLength ? 'lime' : 'white';
            const charWidth = fontSize * 0.6;
            const textX = this.x + (i * charWidth) - (this.text.length * charWidth / 2);
            ctx.fillText(this.text[i], textX, textY);
        }
    }

    explode() {
        this.exploding = true;
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(this.x, this.y));
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.textInput = document.getElementById('textInput');
        this.currentInputDiv = document.getElementById('currentInput');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.words = [];
        this.score = 0;
        this.level = 1;
        this.spawnDelay = 2000;
        this.lastSpawn = 0;
        this.input = '';
        this.themes = { 'cities': [], 'footballers': [] };
        this.wordMapping = {};
        this.currentTheme = 'cities';
        this.isPaused = false;
        this.gameStarted = false;
        this.dataLoaded = false;
        
        this.setupControls();
        this.setupVirtualKeyboard();
        this.loadData();
    }

    resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    async loadData() {
        try {
            console.log('Начинаем загрузку данных...');
            
            const responses = await Promise.all([
                fetch('countries_full_ru.txt').then(r => {
                    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                    return r.text();
                }),
                fetch('footballers.txt').then(r => {
                    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                    return r.text();
                }),
                fetch('wordMapping.json').then(r => {
                    if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                    return r.json();
                })
            ]);

            const [countriesText, footballersText, mapping] = responses;
            console.log('Файлы загружены успешно');

            // Обработка данных о столицах
            this.themes.cities = countriesText.split('\n')
                .map(line => {
                    const parts = line.split(' - ');
                    return parts.length === 3 ? { 
                        capital: parts[2].trim(), 
                        code: parts[1].trim() 
                    } : null;
                })
                .filter(item => item !== null && item.capital.length > 0);

            // Обработка данных о футболистах
            this.themes.footballers = footballersText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(name => ({ name }));

            this.wordMapping = mapping;
            this.dataLoaded = true;
            
            console.log(`Загружено столиц: ${this.themes.cities.length}`);
            console.log(`Загружено футболистов: ${this.themes.footballers.length}`);
            console.log('Данные готовы к использованию');
            
            // Показываем кнопку старт
            document.getElementById('startButton').disabled = false;
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert(`Не удалось загрузить данные: ${error.message}\nПроверьте наличие файлов: countries_full_ru.txt, footballers.txt, wordMapping.json`);
        }
    }

    setupControls() {
        const themeSelect = document.getElementById('themeSelect');
        const startButton = document.getElementById('startButton');
        
        // Отключаем кнопку старт до загрузки данных
        startButton.disabled = true;
        startButton.textContent = 'Загрузка...';
        
        themeSelect.addEventListener('change', e => {
            this.currentTheme = e.target.value;
            this.endGame();
        });

        startButton.addEventListener('click', () => {
            if (!this.dataLoaded) {
                alert('Данные еще загружаются, подождите...');
                return;
            }
            
            if (!this.gameStarted) {
                this.gameStarted = true;
                this.gameLoop();
                startButton.textContent = 'Возобновить';
            }
            this.isPaused = false;
            this.textInput.focus();
        });

        document.getElementById('pauseButton').addEventListener('click', () => {
            this.pauseGame();
        });

        document.getElementById('endButton').addEventListener('click', () => {
            this.endGame();
        });

        // Обработка ввода
        this.textInput.addEventListener('input', (e) => {
            if (this.isPaused || !this.gameStarted) return;
            
            this.input = e.target.value.toUpperCase();
            this.currentInputDiv.textContent = this.input;
            
            // Проверка соответствия текущему слову
            if (this.words.length > 0) {
                const target = this.words[0].text;
                if (!target.startsWith(this.input)) {
                    this.input = '';
                    this.textInput.value = '';
                    this.currentInputDiv.textContent = '';
                    // Небольшая вибрация на мобильных устройствах
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }
                    return;
                }
            }
            
            this.checkInput();
        });

        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.checkInput();
            }
        });

        // Предотвращаем потерю фокуса во время игры
        this.textInput.addEventListener('blur', () => {
            if (this.gameStarted && !this.isPaused) {
                setTimeout(() => {
                    this.textInput.focus();
                }, 100);
            }
        });

        // Автофокус при клике на canvas
        this.canvas.addEventListener('click', () => {
            if (this.gameStarted && !this.isPaused) {
                this.textInput.focus();
            }
        });
    }

    setupVirtualKeyboard() {
        const keyboard = document.getElementById('virtualKeyboard');
        const toggleBtn = document.getElementById('toggleKeyboard');
        
        const russianKeys = [
            'Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З',
            'Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж',
            'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Х'
        ];

        // Создаем кнопки для букв
        russianKeys.forEach(key => {
            const button = document.createElement('button');
            button.className = 'key';
            button.textContent = key;
            button.addEventListener('click', () => {
                if (this.isPaused || !this.gameStarted) return;
                this.textInput.value += key;
                this.textInput.dispatchEvent(new Event('input'));
                this.textInput.focus();
            });
            keyboard.appendChild(button);
        });

        // Кнопка Backspace
        const backspaceBtn = document.createElement('button');
        backspaceBtn.className = 'key backspace';
        backspaceBtn.textContent = '⌫';
        backspaceBtn.addEventListener('click', () => {
            if (this.isPaused || !this.gameStarted) return;
            this.textInput.value = this.textInput.value.slice(0, -1);
            this.textInput.dispatchEvent(new Event('input'));
            this.textInput.focus();
        });
        keyboard.appendChild(backspaceBtn);

        // Переключатель клавиатуры
        toggleBtn.addEventListener('click', () => {
            if (keyboard.style.display === 'none' || keyboard.style.display === '') {
                keyboard.style.display = 'grid';
                toggleBtn.textContent = 'Скрыть клавиатуру';
            } else {
                keyboard.style.display = 'none';
                toggleBtn.textContent = 'Клавиатура';
            }
        });
    }

    getImagePath(word) {
        if (this.currentTheme === 'cities') {
            const code = this.wordMapping.cities && this.wordMapping.cities[word];
            return code ? `images/capitals/${code.toUpperCase()}.png` : null;
        } else if (this.currentTheme === 'footballers') {
            const code = this.wordMapping.footballers && this.wordMapping.footballers[word];
            return code ? `images/footballers/${code}.png` : null;
        }
        return null;
    }

    spawnWord() {
        if (!this.dataLoaded) return;
        
        const themeData = this.themes[this.currentTheme];
        if (!themeData.length || this.words.length) return;

        const randomItem = themeData[Math.floor(Math.random() * themeData.length)];
        const wordText = this.currentTheme === 'cities' ? randomItem.capital : randomItem.name;
        const imgSrc = this.getImagePath(wordText);
        
        if (!imgSrc) {
            console.warn(`Не найден путь к изображению для слова: ${wordText}`);
            return;
        }

        const minX = this.canvas.width * 0.2;
        const maxX = this.canvas.width * 0.8;
        const x = minX + Math.random() * (maxX - minX);

        const word = new Word(wordText, x, imgSrc);
        word.speed = 0.3 + (this.level - 1) * 0.2;
        this.words.push(word);
    }

    gameLoop() {
        if (this.isPaused || !this.gameStarted) return;
        
        const now = Date.now();
        if (now - this.lastSpawn > this.spawnDelay) {
            this.spawnWord();
            this.lastSpawn = now;
        }
        
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.words.forEach((word, idx) => {
            word.update();
            if (word.exploding && !word.particles.length) {
                this.words.splice(idx, 1);
                // Спавним новое слово после взрыва
                setTimeout(() => this.spawnWord(), 500);
            } else if (!word.exploding && word.y > this.canvas.height) {
                this.words.splice(idx, 1);
                // Штраф за пропущенное слово
                this.score = Math.max(0, this.score - 5);
            }
        });

        // Повышение уровня
        if (this.score >= 50 && this.level === 1) {
            this.level = 2;
            this.spawnDelay = 1500;
            this.words.forEach(w => w.speed = 0.6);
        } else if (this.score >= 100 && this.level === 2) {
            this.level = 3;
            this.spawnDelay = 1000;
            this.words.forEach(w => w.speed = 0.9);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.words.forEach(w => w.draw(this.ctx, this.input));
        document.getElementById('score').textContent = `Очки: ${this.score} (Уровень ${this.level})`;
    }

    checkInput() {
        if (!this.words.length || !this.input) return;
        
        if (this.words[0].text === this.input) {
            this.words[0].explode();
            this.score += 10;
            this.input = '';
            this.textInput.value = '';
            this.currentInputDiv.textContent = '';
            
            // Вибрация при успехе на мобильных устройствах
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 50]);
            }
        }
    }

    pauseGame() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseButton');
        
        if (this.isPaused) {
            this.input = '';
            this.textInput.value = '';
            this.currentInputDiv.textContent = '';
            pauseBtn.textContent = 'Продолжить';
        } else {
            pauseBtn.textContent = 'Пауза';
            if (this.gameStarted) {
                this.textInput.focus();
                this.gameLoop();
            }
        }
    }

    endGame() {
        this.isPaused = true;
        this.gameStarted = false;
        this.words = [];
        this.score = 0;
        this.level = 1;
        this.spawnDelay = 2000;
        this.input = '';
        this.textInput.value = '';
        this.currentInputDiv.textContent = '';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('score').textContent = `Очки: 0 (Уровень 1)`;
        document.getElementById('startButton').textContent = this.dataLoaded ? 'Старт' : 'Загрузка...';
        document.getElementById('pauseButton').textContent = 'Пауза';
    }
}

// Инициализация игры после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    
    // Предотвращение зума при двойном тапе
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Предотвращение случайного обновления страницы
    window.addEventListener('beforeunload', (e) => {
        if (game.gameStarted && !game.isPaused) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});