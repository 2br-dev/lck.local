import Lazy from 'vanilla-lazyload';
import Hyphenate from './lib/hyphenate';
import * as $ from 'jquery';
import * as M from 'materialize-css';
import mask from 'imask';
import Tilt from 'vanilla-tilt';
import App, {IHoverData, IMousePos, IUploadingModel, IElementDetails, IChar} from './lib/app';

declare var ymaps:any;

let models = [];
let min = 0;
let tooltip:HTMLElement;
let app = null;

let startX:number, startY:number, endX:number, endY:number;

document.body.addEventListener('mousedown', (e:MouseEvent) => {
	startX = e.pageX;
	startY = e.pageY;
});

document.body.addEventListener('mouseup', (e:MouseEvent) => {
	endX = e.pageX;
	endY = e.pageY;
});

(() => {

	// Текущий год в Footer
	let year = new Date().getFullYear();
	document.querySelector('#year').textContent = year.toString();

	// Подсказки
	let tooltip = M.Tooltip.init(document.querySelectorAll('[data-tooltip]'));

	// Приложение ThreeJS
	if(document.querySelectorAll('#three-app').length){
		initThreeApp();
	}

	// Tilt для иллюстрации приложения
	if(document.querySelectorAll('.tilt').length){
		let tilt = new Tilt(document.querySelector('.level1'), {
			max: 6
		})
	}	

	// Маска для телефонов
	document.querySelectorAll('.phone-mask').forEach((el:HTMLElement) => {
		mask(el, {
			mask: "+{7} (000) 000-00-00"
		})
	})

	// Закрытие модалок
	document.body.addEventListener('click', closeAllModals);

	// Загрузка "ленивых" картинок
	let lazy = new Lazy({
		elements_selector: '.lazy',
		threshold: 0
	});
	
	const lazyload = () => {
		lazy.update();
	};
	
	window.addEventListener('load', lazyload);
	window.addEventListener('resize', lazyload);
	
	// Обновление Navbar
	updateHeader();

	// Переносы
	let hyphen = new Hyphenate("p");

	// Sidenav (мобильная навигация)
	let sidenav = M.Sidenav.init(document.querySelector('.sidenav'), {
		edge: 'right'
	});

	// Вкладки
	if(document.querySelectorAll('.tabs').length){
		let tabs = M.Tabs.init(document.querySelectorAll('.tabs'));
	}

	// Установка прозрачности Navbar'а при скролле
	document.addEventListener('scroll', correctHeader);
	correctHeader();

	// Якорные ссылки
	document.querySelectorAll('.scroll-link').forEach((el:HTMLLinkElement) => {
		el.addEventListener('click', slideTo);
	});

	// Вопрос-ответ
	let questions = document.querySelectorAll('.question');
	if(questions.length){
		questions.forEach((el:HTMLDivElement) => {
			el.addEventListener('click', toggleAnswer);
		})
	}
	
	// Загрузка карт
	if($('#map').length) loadScript('https://api-maps.yandex.ru/2.1/?lang=ru_RU', initMap, () => {
		console.error("Ошибка подгрузки скрипта!");
	});

	// Украшательства
	if(document.querySelectorAll('[data-ratio]').length){
		window.addEventListener('scroll', updateElements);
	}

	// Collapsible
	if(document.querySelectorAll('article').length){
		$('body').on('click', '.article-header', (e:JQuery.ClickEvent) => {
			let el = <HTMLElement>e.currentTarget;
			let body = el.nextElementSibling;
			
			$(body).slideToggle('fast');
			$(el).toggleClass('active');
		})
	}

})();

/**
 * Обновление классов ссылок в Navbar при скролле
 */
function updateHeader(){

	let sections = ["about", "rent", "contacts"];

	sections.forEach((section:string) => {

		let header = <HTMLElement>document.querySelector('header');
		let sectionTrigger = <HTMLElement>header.querySelector(`[href="/#${section}"]`);
		let sectionElement = <HTMLElement>document.querySelector( `#${section}` );

		if(sectionElement && sectionTrigger){
			observe(sectionElement, sectionTrigger);
		}
	})
}

/**
 * Отображение вопросов/ответов при клике по заголовку
 * @param {Event} e - Эвент мыши
 */
function toggleAnswer(e:Event){
	
	let question = <HTMLElement>e.currentTarget;
	let answer = <HTMLDivElement>question.nextElementSibling;

	$(question).toggleClass('active');
	$(answer).slideToggle('fast');
}

/**
 * @param {Event} e Прокрутка до указанного в href анкора
 */
function slideTo(e:Event){

	let link = <HTMLLinkElement>e.currentTarget;
	let href = new URL(link.href);
	let anchor = href.hash;
	let elementToScroll = <HTMLElement>document.querySelector(anchor);
	let header = document.querySelector('header');
	let headerHeight = header?.clientHeight;

	if(elementToScroll != null){

		e.preventDefault();
		let sidenavEl = document.querySelector('.sidenav');
		let sidenav = M.Sidenav.getInstance(sidenavEl);
		sidenav.close();
		let top = elementToScroll.offsetTop - headerHeight;

		$('body, html').animate({
			scrollTop: top
		}, 400)
	}
}

/**
 * Установка прозрачности Navbar
 */
function correctHeader(){

	let scrollTop = document.documentElement.scrollTop;
	let opacity = scrollTop / 1000;
	if(opacity > .7) opacity = .7;
	
	let blur = 20 * opacity;

	let header =  document.querySelector('header');

	let style = `
		background: rgba(0,0,0,${opacity});
		backdrop-filter: blur(${blur}px);
		-webkit-backdrop-filter: blur(${blur}px);
		-o-backdrop-filter: blur(${blur}px);
		-moz-backdrop-filter: blur(${blur}px);
	`;

	header?.setAttribute("style", style);
	
}

/**
 * Динамическая подгрузка скрипта
 * @param {string} url URL скрипта, который нужно подгрузить
 * @param {() => void} callback Обработчик, запускающийся после успешной подгрузки скрипта
 * @param {() => void} errorCallback? Обработчик, запускающийся после ошибки загрузки скрипта (необязательно)
 */
function loadScript(url:string, callback:() => void, errorCallback: () => void = () => {}){

	var script = document.createElement("script")
	script.type = "text/javascript";

	let scriptMedia = <any>script;
	
	if (scriptMedia.readyState){  //IE
		scriptMedia.onreadystatechange = function(){
			if (scriptMedia.readyState == "loaded" ||
				scriptMedia.readyState == "complete"){
				scriptMedia.onreadystatechange = null;
				callback();
			}else{
				errorCallback();
			}
		};
	} else {  //Others
		script.onload = function(){
			callback();
		};
		script.onerror = function(){
			errorCallback();
		}
	}

	script.src = url;
	document.getElementsByTagName("head")[0].appendChild(script);
}

/**
 * Инициализация карты
 */
function initMap(){

	ymaps.ready(() => {

		let center = [45.046517, 38.926166];
	
		let map = new ymaps.Map("map", {
			center: center,
			zoom: 16,
		});

		let marker = new ymaps.Placemark(center, {}, {
			preset: "islands#violetStretchyIcon",
			draggable: false
		});

		map.behaviors.disable('scrollZoom');

		marker.events.add('click', () => {
			let url = "https://yandex.ru/maps/-/CDBXiUOK";
			window.open(url,"_blank");
		});

		map.geoObjects.add(marker);
	})
}

/**
 * Отслеживание активной ссылки по скроллу
 * @param {HTMLElement} elToObserve - отслеживаемый элемент 
 * @param {HTMLElement} triggerElement - триггер, для которого проставляется класс Active
 */
function observe(elToObserve:HTMLElement, triggerElement:HTMLElement){

	let observer = new window.IntersectionObserver(([entry]) => {
		if(entry.isIntersecting){
			triggerElement.classList.add('active');
		}else{
			triggerElement.classList.remove('active');
		}
	}, {
		threshold: .26
	})

	observer.observe(elToObserve);
}

/**
 * Обновление элементов с абсолютным позиционированием при скролле
 */
function updateElements(){

	let current = document.documentElement.scrollTop;
	let max = document.documentElement.scrollHeight - window.innerHeight;
	let percent = (current / max) * 100;

	document.querySelectorAll('[data-ratio]').forEach((el:HTMLElement) => {
		let ratio = parseFloat(el.dataset['ratio']);
		if(isNaN(ratio)) return;

		let shift = percent * ratio;

		el.style.transform = `translateY(${shift}%)`;
	})
}

/**
 * Инициализация приложения THREEJS
 */
function initThreeApp(){

	tooltip = document.createElement('div');
	tooltip.classList.add("tooltip");
	tooltip.style.display = "none";
	tooltip.style.padding = "10px";
	tooltip.style.background = "rgba(0,0,0,.7)";
	tooltip.style.color = "white";
	tooltip.style.fontFamily = "sans-serif";
	tooltip.style.pointerEvents = 'none';

	let name = document.createElement('span');
	tooltip.appendChild(name);

	let action = document.createElement('a');
	action.className = 'bx bx-chevron-right';
	action.setAttribute('href', 'javascript:void(0)');

	tooltip.appendChild(action);

	tooltip.addEventListener('click', (e:MouseEvent) => {
		let el = <HTMLElement>e.currentTarget;
		el.style.display = "none";
		let link = el.querySelector('a');
		let alias = link.dataset['alias'];
		let header = document.querySelector('header');
		let headerHeight = header?.getBoundingClientRect().height || 0;

		let listTarget = <HTMLElement>document.querySelector(`.accordion [data-object-name="${alias}"]`);
		listTarget.classList.add('active');
		let listTargetTop = listTarget.offsetTop - headerHeight;
		let description = listTarget.nextElementSibling;

		$('html, body').animate({ 
			scrollTop: listTargetTop,
		}, 500, function() {
			$(description).slideDown('fast');
		});
		
	})

	document.body.append(tooltip);

	let interactives = [
		"camera",
		"lamps",
		"main-screen",
		"projector",
		"screens-system",
		"sensor-screen",
		"assistent-place",
		"server",
		"sufler",
	];

	let statics = [
		"room",
		"office-woman",
		"girl",
		"cube-green",
		"cube-white",
		"chair"
	];

	let canvas = <HTMLCanvasElement>document.getElementById('three-app');
	app = new App(canvas, false);

	(window as any).app = app;

	// Элементы окружения
	statics.forEach(el => {
		getModel(el, false)
	});

	// Интерактивные элементы
	interactives.forEach(el => {
		getModel(el, true);
	});

	// Формирование данных для прелоадера
	let total = models.length;
	let step = 100 / total;

	// Обработка процесса загрузки моделей
	app.on("model_loading", function(data:IUploadingModel){

		let current = 0;
		let max = 100 * models.length;

		models.forEach(model => {
			if (model.progress){
				current += model.progress.percent
			}
		});

		let total_percent = current / max * 100;
		let indicator = <HTMLElement>document.querySelector('.percent');

		indicator.style.width = total_percent + "%"
		
	});

	// Обработка завершения загрузки моделей
	app.on("model_loaded", function(){
		total --;
		if(total == 0){
			let splash = <HTMLElement>document.querySelector('.splash');
			splash.classList.add('loaded');
		}
		min += step;
	})

	// Обработка клика по модели
	app.on('object-clicked', function(object:any){
		if(object.isInteractive){
			openModal(object.name);
		}
	});

	// Скрытие тултипа по щелчку
	app.on('mousedown', () => {
		if(window.innerWidth >= 600){
			tooltip.style.display = "none";
		}
	});

	// Перемещение тултипа
	app.on('mousemove', (mousedata:IMousePos) => {
		tooltip.style.top = mousedata._y + 20 + "px"

		let left = mousedata._x + 20;
		tooltip.style.left = left + "px";
		let tooltipWidth = tooltip.getBoundingClientRect().width;
		let tooltipLeft = tooltip.getBoundingClientRect().left;
		let diff = window.innerWidth - (tooltipLeft + tooltipWidth + 40);

		if(diff < 0){
			left -= Math.abs(diff);
			tooltip.style.left = left + "px";
		}
	});

	// Скрытие тултипа, когда за пределами приложения
	app.on('mouseleave', () => {
		if(window.innerWidth >= 600){
			tooltip.style.display = "none";
		}
	})

	// Подсветка объекта под курсором мыши
	app.on('intersect', (data:IHoverData) => {

		let tooltipText = tooltip.querySelector('span');
		let tooltiplink = tooltip.querySelector('a');

		tooltiplink.dataset['alias'] = data.object.name;
	
		let alreadyFixed = tooltip.style.position == 'fixed';
		let alreadyDisplay = tooltip.style.display == 'flex';
		let alreadyText = tooltipText.innerHTML == getName(data.object.name);

		if(!alreadyFixed) tooltip.style.position = 'fixed';
		if(!alreadyDisplay) tooltip.style.display = 'flex';
		if(!alreadyText) tooltipText.innerHTML = `${getName(data.object.name)}`;

		canvas.style.cursor = 'pointer';
		tooltip.style.top = data.mousePos._y + 20 + "px";
		
		let left = data.mousePos._x + 20;
		tooltip.style.left = left + "px";
		let tooltipWidth = tooltip.getBoundingClientRect().width;
		let tooltipLeft = tooltip.getBoundingClientRect().left;
		let diff = window.innerWidth - (tooltipLeft + tooltipWidth + 40);

		if(diff < 0){
			left -= Math.abs(diff);
			tooltip.style.left = left + "px";
		}

		document.querySelectorAll('[data-alias]').forEach((el:HTMLElement) =>{
			el.classList.remove('hover');
		})

		let point = <HTMLElement>document.querySelector(`[data-alias="${data.object.name}"]`);
		point.classList.add('hover');

	})

	// Снятие подсветки с объекта, когда курсор мыши ушёл с объекта
	app.on('lost-intersect', (e:MouseEvent) => {
		canvas.style.cursor = 'default';

		let path = e.composedPath();
		let tooltipPath = path.filter((el:HTMLElement) => {
			return el.className == 'tooltip'
		});

		if(!tooltipPath.length){
			tooltip.style.display = 'none';
		}


		document.querySelectorAll('[data-alias]').forEach((el:HTMLElement) =>{
			el.classList.remove('hover');
		})
	})

	// Загрузка моделей
	models.forEach(model => {
		app.loadModel(model);
	});

	// Подсветка объектов по наведению на эскизы
	document.querySelectorAll('[data-alias]').forEach((el:HTMLElement) => {
		el.addEventListener('mouseenter', function(e:Event){
			let el = <HTMLElement>e.currentTarget;
			let alias = el.dataset['alias'];
			app.focusModel(alias);
		})

		el.addEventListener('mouseleave', function(e:Event){
			let el = <HTMLElement>e.currentTarget;
			let alias = el.dataset['alias'];
			app.blurModel(alias);
		})
	})

	app.rotationXHelper.rotation.y = 1.0;

	document.querySelectorAll('[data-alias]').forEach((el:HTMLLIElement) => {
		el.addEventListener('click', (e:MouseEvent) => {
			let alias = el.dataset['alias'];
			openModal(alias);
		})
	})
}

/**
 * Формирование массива моделей
 * @param {string} model 
 * @param {boolean} isinteractive 
 */
function getModel(model:string, isinteractive:boolean){
	let emmisive = model == "sensor-screen-lamp";
	let alphaMap = model == "sensor-screen" ? `/3d/textures/sensor-screen-alpha.jpg` : null

	let modelObj:IUploadingModel = {
		id:model,
		isEmissive: emmisive,
		isinteractive: isinteractive,
		modelpath: `/3d/models/${model}.drc`,
		diffusetexture: `/3d/textures/${model}.jpg`,
		alphatexture: alphaMap
	}

	models.push(modelObj);
}

/**
 * Получение имени
 * @param {string} alias - алиас модели
 * @returns {string} Читаемое имя модели
 */
function getName(alias:string){
	let name:string = "";
	switch(alias){
		case "camera": name="Камера 4К" ;break;
		case "lamps": name="Система освещения" ;break;
		case "main-screen": name="Система фонов" ;break;
		case "projector": name="Комплект проекционного оборудования" ;break;
		case "screens-system": name="Система экранов спикера" ;break;
		case "assistent-place": name="Место для ассистента" ;break;
		case "server": name="Сервер" ;break;
		case "sufler": name="Телесуфлёр" ;break;
		case "sensor-screen": name="Сенсорный экран" ;break;
	}
	return name;
}

/**
 * Открытие модального окна с описанием элемента
 * @param {string} name Алиас открываемого элемента
 */
function openModal(name:string){

	// Если сайт открыт на мобилке, модалки не создаём
	if(window.innerWidth <= 850) return;

	// Закрываем уже открытые модалки
	document.querySelectorAll('.modal').forEach((modal:HTMLElement) => {
		modal.classList.remove('open');
		setTimeout(() => {
			modal.remove();
		}, 600)
	})

	// Получение данных
	fetch("/data/descriptions.json")
		.then(res => res.json())
		.then((data) => {
			
			let element:IElementDetails = data.filter((el:IElementDetails) => {
				return el.name === name
			})[0];

			//= Формирование DOM модального окна ======================
			// Оболочка 
			let wrapper = document.createElement("div");
			wrapper.className = "modal"

			// Заголовок
			let headerWrapper = document.createElement("div");
			headerWrapper.className = "modal-header";
			
			let h3 = document.createElement('h3');
			h3.textContent = element.title;

			let closeLink = document.createElement("a");
			closeLink.classList.add('bx');
			closeLink.classList.add('bx-x');
			closeLink.href="javascript:void(0)";

			headerWrapper.appendChild(h3);
			headerWrapper.appendChild(closeLink);

			wrapper.appendChild(headerWrapper);

			closeLink.addEventListener("click", closeModal);

			// Описание
			let intro = document.createElement("div");
			intro.className = "intro";

			element.intro?.forEach(el => {
				let paragraph = document.createElement("p");
				paragraph.textContent = el;
				wrapper.appendChild(paragraph);
			})

			if(element.intro)
				wrapper.appendChild(intro);

			// Заголовок характеристик
			let charTitle = document.createElement("h4");
			charTitle.textContent = element.chartitle;
			charTitle.className = "chartitle";

			wrapper.appendChild(charTitle);

			// Список характеристик
			let charWrapper = document.createElement("div");
			charWrapper.className = "chars";

			element.chars?.forEach((charitem:IChar | string) => {
				let kvPair = document.createElement("div");
				kvPair.className = "kv-pair";

				if(typeof(charitem) == "string"){
					let key = document.createElement("div");
					key.className = "key";
					key.textContent = charitem;
					kvPair.appendChild(key);
				}else{
					let key = document.createElement("div");
					key.className = "key";
					key.textContent = charitem.key;
					kvPair.appendChild(key);

					if(charitem.value){
						let value = document.createElement("div");
						value.className = "value";
						value.textContent = charitem.value;
						kvPair.appendChild(value);
					}
				}

				charWrapper.appendChild(kvPair);
			})

			wrapper.appendChild(charWrapper);

			// Ссылка
			if(element.link){
				let link = <HTMLAnchorElement>document.createElement("a");
				link.text  = element.link.text;
				link.href = element.link.url;
				link.className = "bttn";
				let linkWrapper = document.createElement('div');
				linkWrapper.className = "link-wrapper";
				
				linkWrapper.appendChild(link);
				wrapper.appendChild(linkWrapper);
			}

			document.body.append(wrapper);

			setTimeout(() => {
				wrapper.classList.add('open');
			})
			
		})
}

/**
 * Закрытие модального окна
 * @param {MouseEvent} e Событие мыши
 */
function closeModal(e:MouseEvent){

	e.preventDefault();
	let el = e.currentTarget;
	let modal = $(el).parents('.modal')[0];

	modal.classList.remove('open');

	setTimeout(() => {
		modal.remove();
	}, 600);
}

/**
 * Закрытие модального окна при клике вне модального окна
 */
function closeAllModals(e:MouseEvent){

	let xDistance = Math.abs(startX - endX);
	let yDistance = Math.abs(startY - endY);

	if(xDistance > 2 || yDistance > 2) return;


	let path = e.composedPath();
	let modal = path.filter((el:HTMLElement) => {
		if(el.classList){
			return el.classList.contains('modal');
		}
	});

	if(modal.length === 0){
		document.querySelectorAll('.modal').forEach((modal:HTMLElement) => {
			modal.classList.remove('open');
			setTimeout(() => {
				modal.remove();
			}, 600);
		})
	}
}