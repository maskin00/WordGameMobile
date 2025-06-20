// game.js (обновлён для исправления ошибок и адаптивного масштабирования)
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
    constructor(text, x, imgSrc, game) {
        this.text = text.toUpperCase();
        this.x = x;
        this.y = 0;
        this.speed = 0.3;
        this.imgSrc = imgSrc;
        this.image = new Image();
        this.image.src = imgSrc;
        this.image.onerror = () => console.error(`Не удалось загрузить изображение: ${this.imgSrc}`);
        this.image.onload = () => console.log(`Изображение загружено: ${this.imgSrc}, размер: ${this.image.width}x${this.image.height}`);
        this.particles = [];
        this.exploding = false;
        this.game = game; // Ссылка на объект Game для доступа к canvas
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

        let scaledWidth = 0;
        let scaledHeight = 0;
        if (this.image.complete && this.image.naturalWidth !== 0) {
            const maxSize = Math.min(this.game.canvas.width, this.game.canvas.height) * 0.3; // 30% от меньшего размера холста
            const width = this.image.width;
            const height = this.image.height;
            const aspectRatio = width / height;
            // Вычисляем масштабирование с сохранением пропорций
            if (aspectRatio > 1) {
                // Широкое изображение (например, флаги 2:1)
                scaledWidth = Math.min(maxSize, width * (maxSize / height));
                scaledHeight = scaledWidth / aspectRatio;
            } else {
                // Высокое или квадратное изображение (например, портреты 1:1)
                scaledHeight = Math.min(maxSize, height * (maxSize / width));
                scaledWidth = scaledHeight * aspectRatio;
            }
            ctx.drawImage(this.image, this.x - scaledWidth / 2, this.y - scaledHeight / 2, scaledWidth, scaledHeight);
        } else {
            ctx.fillStyle = 'lightgray';
            ctx.fillRect(this.x - 50, this.y - 50, 100, 100);
            ctx.fillStyle = 'black';
            ctx.fillText('?', this.x - 10, this.y + 10);
        }

        ctx.font = '25px Arial';
        const inputUpper = input.toUpperCase();
        let matchedLength = 0;
        for (let i = 0; i < inputUpper.length && i < this.text.length; i++) {
            if (inputUpper[i] === this.text[i]) matchedLength++;
            else break;
        }
        for (let i = 0; i < this.text.length; i++) {
            ctx.fillStyle = i < matchedLength ? 'lime' : 'white';
            const textX = this.x + (i * 20) - (this.text.length * 10);
            const textY = this.y + scaledHeight / 2 + 30; // Корректировка позиции текста
            ctx.fillText(this.text[i], textX, textY);
        }
    }

    explode() {
        this.exploding = true;
        for (let i = 0; i < 20; i++) this.particles.push(new Particle(this.x, this.y));
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.updateCanvasSize(); // Инициализация адаптивных размеров canvas
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
        this.setupMobileKeyboard();
        this.loadData();
        window.addEventListener('resize', () => this.updateCanvasSize()); // Обновление при изменении размера окна
    }

    updateCanvasSize() {
        const container = document.getElementById('gameContainer');
        if (container) {
            this.canvas.width = container.offsetWidth;
            this.canvas.height = container.offsetHeight;
            this.draw(); // Перерисовка после изменения размеров
        }
    }

    async loadData() {
        try {
            const responses = await Promise.all([
                fetch('countries_full_ru.txt').then(r => r.text()),
                fetch('footballers.txt').then(r => r.text()),
                fetch('wordMapping.json').then(r => r.json())
            ]);
            const [countriesText, footballersText, mapping] = responses;

            this.themes.cities = countriesText.split('\n')
                .map(line => {
                    const parts = line.split(' - ');
                    return parts.length === 3 ? { capital: parts[2].trim(), code: parts[1].trim() } : null;
                })
                .filter(item => item !== null);

            this.themes.footballers = footballersText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(name => ({ name }));

            this.wordMapping = mapping;
            this.startGame();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные. Проверьте наличие файлов.');
        }
    }

    setupMobileKeyboard() {
        const keyboard = document.getElementById('keyboard');
        if (!keyboard) {
            console.error('Элемент keyboard не найден в DOM');
            return;
        }
        const letters = ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ъ',
                         'Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э',
                         'Я','Ч','С','М','И','Т','Ь','Б','Ю','-',' '];
        keyboard.innerHTML = '';
        letters.forEach(letter => {
            const key = document.createElement('button');
            key.className = 'key';
            key.textContent = letter === ' ' ? 'Пробел' : letter;
            if (letter === ' ' || letter === '-') {
                key.className += ' special';
            }
            key.addEventListener('click', () => {
                this.input += letter.toUpperCase();
                this.checkInput();
            });
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.input += letter.toUpperCase();
                this.checkInput();
            }, { passive: false });
            keyboard.appendChild(key);
        });

        const clear = document.createElement('button');
        clear.className = 'key special';
        clear.textContent = '← Очистить';
        clear.addEventListener('click', () => {
            this.input = '';
        });
        clear.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.input = '';
        }, { passive: false });
        keyboard.appendChild(clear);
    }

    startGame() {
        document.getElementById('startButton').addEventListener('click', () => {
            if (!this.isPaused && this.themes[this.currentTheme].length > 0) this.gameLoop();
            this.isPaused = false;
            document.getElementById('startButton').blur();
        });
        document.getElementById('pauseButton').addEventListener('click', () => this.pauseGame());
        document.getElementById('endButton').addEventListener('click', () => this.endGame());

        document.addEventListener('keydown', e => {
            if (this.isPaused) return;
            const key = e.key;
            if (/^[а-яА-ЯёЁ \-]$/.test(key)) {
                this.input += key.toUpperCase().replace('Ё', 'Е');
                this.checkInput();
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                this.input = '';
                e.preventDefault();
            } else if (e.key === ' ' && document.activeElement.tagName === 'BUTTON') {
                e.preventDefault();
            }
        });

        document.getElementById('themeSelect').addEventListener('change', e => {
            this.currentTheme = e.target.value;
            this.endGame();
        });
    }

    getImagePath(word) {
        if (this.currentTheme === 'cities') {
            const code = this.wordMapping.cities[word];
            return code ? `images/capitals/${code.toUpperCase()}.png` : null;
        } else if (this.currentTheme === 'footballers') {
            const code = this.wordMapping.footballers[word];
            return code ? `images/footballers/${code}.png` : null;
        }
        return null;
    }

    spawnWord() {
        const themeData = this.themes[this.currentTheme];
        if (!themeData.length || this.words.length > 0) return;

        const randomItem = themeData[Math.floor(Math.random() * themeData.length)];
        const wordText = this.currentTheme === 'cities' ? randomItem.capital : randomItem.name;
        const imgSrc = this.getImagePath(wordText);
        if (!imgSrc) {
            console.warn(`No image found for ${wordText}`);
            return;
        }

        const x = this.canvas.width / 2;
        const word = new Word(wordText, x, imgSrc, this); // Передаем this как game
        this.words.push(word);
    }

    gameLoop() {
        if (this.isPaused) return;
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
            if (word) {
                word.update();
                if (word.exploding && !word.particles.length) {
                    this.words.splice(idx, 1);
                } else if (!word.exploding && word.y > this.canvas.height) {
                    this.words.splice(idx, 1);
                }
            }
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.words.forEach(w => {
            if (w) w.draw(this.ctx, this.input);
        });
        document.getElementById('score').textContent = `Очки: ${this.score} (Уровень ${this.level})`;
    }

    checkInput() {
        if (!this.words.length || !this.input) return;

        const currentWord = this.words[0].text;
        const inputUpper = this.input.toUpperCase();
        let matchedLength = 0;

        for (let i = 0; i < inputUpper.length && i < currentWord.length; i++) {
            if (inputUpper[i] === currentWord[i]) {
                matchedLength++;
            } else {
                this.input = '';
                return;
            }
        }

        if (matchedLength === currentWord.length) {
            this.words[0].explode();
            this.score += 10;
            this.input = '';
        }
    }

    pauseGame() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) this.input = '';
    }

    endGame() {
        this.isPaused = true;
        this.words = [];
        this.score = 0;
        this.level = 1;
        this.input = '';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('score').textContent = `Очки: 0 (Уровень 1)`;
    }
}

const game = new Game();