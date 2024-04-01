import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TextureLoader } from 'three';
import { Raycaster } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';
import { SSAARenderPass } from 'three/examples/jsm/postprocessing/SSAARenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

export interface IMousePos{
	x:number, y:number, _x:number, _y:number
}

export interface IProgressData{
	total:number,
	loaded:number,
	percent:number
}

export interface IUploadingModel{
	id:string,
	modelpath:string,
	diffusetexture?:string,
	alphatexture?:string,
	isinteractive?:boolean
	isEmissive?:boolean,
	progress?: IProgressData
}

export interface IHoverData{
	object:THREE.Object3D | null,
	mousePos: IMousePos
}

export interface IChar{
	key?: string,
	value?: string
}

export interface ILink{
	text: string,
	url: string
}

export interface IElementDetails{
	"name": string,
	"title": string,
	"image": string,
	"intro"?: Array<string>,
	"chartitle"?: string,
	"chars"?: Array<IChar> | Array<string>,
	"link"?: ILink
}

class App{

	scene:THREE.Scene;
	camera:THREE.PerspectiveCamera;
	helperCamera:THREE.PerspectiveCamera;
	light:THREE.DirectionalLight;
	renderer:THREE.WebGLRenderer;
	canvas:HTMLCanvasElement;
	events: Array<any> = [];
	rotationXHelper:THREE.Mesh;
	rotationYHelper:THREE.Mesh;
	controls:OrbitControls;
	activeCamera: THREE.PerspectiveCamera;
	debug:boolean;
	raycaster:Raycaster;
	outlinepass:OutlinePass;
	outputpass:OutputPass;
	renderpass:RenderPass;
	composer:EffectComposer;
	effectFXAA:any;
	container:HTMLElement;

	mousepos:IMousePos;
	mouseStartPos:IMousePos;
	mouseEndPos:IMousePos;

	mousePressed:boolean;
	hasIntersection:boolean;

	selectedObjects:Array<THREE.Object3D> = [];

	sceneObjects:Array<THREE.Object3D> = [];

	/**
	 * Инициализация приложения ThreeJS
	 * @param canvas {HTMLCanvasElement} - Элемент DOMа, куда будет выводится рендер
	 * @param debug {boolean} - Режим отладки
	 */
	constructor(canvas:HTMLCanvasElement, debug:boolean = true){

		this.canvas = canvas;
		this.debug = debug;

		window.addEventListener('resize', this.windowResize.bind(this));
		this.canvas.addEventListener('mousemove', this.updateMouse.bind(this));
		this.canvas.addEventListener('mousedown', function(){ 
			this.mousePressed = true 
			this.mouseStartPos = this.mousepos;
			this.triggerEvent('mousedown', this.mousepos);
		}.bind(this));
		this.canvas.addEventListener('mouseup', function(){ 
			this.mousePressed = false 
			this.mouseEndPos = this.mousepos
			this.canvasClick();
			this.triggerEvent('mouseup', this.mousepos);
		}.bind(this));

		this.container = <HTMLElement>canvas.parentElement;

		this.container.addEventListener('mouseleave', () => {
			this.triggerEvent('mouseleave');
		})

		this.mousepos = {
			x: 0,
			y: 0,
			_x: 0,
			_y: 0
		}

		this.scene = new THREE.Scene();
		this.raycaster = new THREE.Raycaster();
		
		this.makeRenderer();
	

		let rotationXGeometry = new THREE.BoxGeometry(.1, 3, .1);
		let rotationMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});

		this.rotationXHelper = new THREE.Mesh(rotationXGeometry, rotationMaterial);
		this.rotationXHelper.position.y = -10;
		this.scene.add(this.rotationXHelper);

		let rotationYGeometry = new THREE.BoxGeometry(.1, .1, 3);
		this.rotationYHelper = new THREE.Mesh(rotationYGeometry, rotationMaterial);
		
		this.scene.add(this.rotationYHelper);

		if(debug){
			this.rotationXHelper.visible = true;
			this.rotationYHelper.visible = true;
		}else{
			this.rotationXHelper.visible = false;
			this.rotationYHelper.visible = false;
		}
	
		this.setupCameras();

		this.controls = new OrbitControls(this.camera, this.canvas);
		this.controls.maxDistance = 120;
		this.controls.minDistance = 40;
		this.controls.enableZoom = false;
		
		this.controls.minPolarAngle = 0;
		this.controls.maxPolarAngle = Math.PI/2; 
		this.controls.minAzimuthAngle = 0;
		this.controls.maxAzimuthAngle= Math.PI/2;
		
		let max = new THREE.Vector3(16, 0, 16);
		let min = new THREE.Vector3(-16, 0, -16);
		let _v = new THREE.Vector3();


		this.controls.addEventListener("change", function(){
			_v.copy(this.controls.target);
			this.controls.target.clamp(min, max);
			_v.sub(this.controls.target);
			this.camera.position.sub(_v);
		}.bind(this));

		//== Пост-просесс ===============================================

		this.composer = new EffectComposer( this.renderer );
		this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.renderpass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(this.renderpass);

		let pixelRatio = window.devicePixelRatio;

		// Подсветка
		this.outlinepass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
		this.outlinepass.edgeStrength = 1.0;
		this.outlinepass.edgeGlow = 4.0;
		this.outlinepass.edgeThickness = 1;
		this.outlinepass.pulsePeriod = 0;
		this.outlinepass.usePatternTexture = false;
		this.outlinepass.visibleEdgeColor.set( 0xffffff );
		this.outlinepass.hiddenEdgeColor.set( 0xffffff );
		this.outlinepass.renderToScreen = true;		
		
		this.effectFXAA = new ShaderPass( FXAAShader );
		this.effectFXAA.uniforms[ 'resolution' ].value.x = 1 / ( this.container.offsetWidth * pixelRatio );
		this.effectFXAA.uniforms[ 'resolution' ].value.y = 1 / ( this.container.offsetHeight * pixelRatio );
		
		let ssaaRenderPass = new SSAARenderPass( this.scene, this.camera );
		ssaaRenderPass.unbiased = true
		ssaaRenderPass.sampleLevel = 5;
		
		// this.composer.addPass(ssaaRenderPass);
		this.composer.addPass(this.outlinepass);
		this.composer.addPass( this.effectFXAA ); 

		//=/ Пост-процесс ===============================================
		
		this.controls.update();

		this.animate();
	}

	/**
	 * Обновление данных  о расположении мыши
	 * @param e {MouseEvent} - событие движения мыши
	 */
	updateMouse(e:MouseEvent){

		new Promise(resolve => {
			this.triggerEvent('mousestart', this.mousepos);

			let scrollTop = document.documentElement.scrollTop;
			let rect = this.canvas.getBoundingClientRect();
	
			this.mousepos = {
				x: (( e.clientX - rect.left ) / ( rect.width - rect.left )) * 2 - 1,
				y: - (( e.clientY - rect.top ) / ( rect.bottom - rect.top )) * 2 + 1,
				_x: e.clientX,
				_y: e.clientY
			}

			resolve(this.mousepos);
		}).then(() => {
			this.triggerEvent('mousemove', this.mousepos);
			this.checkIntersection(e);
		})
	}

	/**
	 * Создание и расстановка камер и освещения
	 */
	setupCameras(){

		let canvas = this.canvas;

		this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, .1, 180);
		this.camera.position.set(0, 20, 80);
		this.camera.name = "Main camera";
		this.camera.lookAt(0,30,0);	
		this.camera.updateWorldMatrix(false, true);
	}

	/**
	 * Назначение событий для приложения 
	 * @param eventName {string} Имя приложения
	 * @param callback {Function} Callback, вызываемый при событии
	 */
	on(eventName:string, callback:Function){
		this.events.push(
			{
				name: eventName,
				callback: callback
			}
		);
	}

	/**
	 * Запуск обработчика событий
	 * @param eventName {string} - название события
	 * @param data {any} - данные, передаваемые инициатором
	 */
	triggerEvent(eventName:string, data?:any){

		let callbacks = this.events.filter(event => {
			return event.name == eventName
		});

		if( callbacks.length ){
			let callback = callbacks[0].callback;
			callback.bind( this );
			callback( data );
		}
	}

	/**
	 * Цикл анимации
	 */
	animate(){
		this.controls.update();
		this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
		// this.renderer.render(this.scene, this.camera);
		this.composer.render();
		
		requestAnimationFrame(this.animate.bind(this));

	}

	/**
	 * Загрузка 3D-модели
	 * @param modelpath {string} - путь к файлу для загрузки
	 * @param texturepath {string} - путь к файлу текстуры
	 */
	loadModel(modelData:IUploadingModel){

		const textureLoader:THREE.TextureLoader = new TextureLoader();

		let diffuseTexture:THREE.Texture | null
		let alphaTexture:THREE.Texture | null

		let material;

		
		if(!modelData.isEmissive){

			let loadMesh = () => {

				// Успешное завершение загрузки текстуры
				const loader:DRACOLoader = new DRACOLoader();
				loader.setDecoderPath('/draco/');
				loader.setDecoderConfig({type: 'wasm'});

				loader.preload();

				loader.load(
					modelData.modelpath,
					function(geometry:THREE.BufferGeometry){
						// Успешное завершение загрузки модели
						this.triggerEvent('model_loaded');

						let model = new THREE.Mesh(geometry, material);
						model.name = modelData.id;
						(model as any).isInteractive = modelData.isinteractive;
						this.scene.add(model);
						model.parent = this.rotationXHelper;
						
						this.sceneObjects.push(model);

						if(this.debug){
							console.info("Модель успешно загружена");
						}
						
					}.bind(this),
					function(xhr:ProgressEvent<EventTarget>){
						// Процесс загрузки
						let loadingData:IProgressData = {
							total: xhr.total,
							loaded: xhr.loaded,
							percent: (xhr.loaded / xhr.total) * 100
						}
						modelData.progress = loadingData
						this.triggerEvent('model_loading', modelData);
					}.bind(this),
					function(err:any){
						// При возникновении ошибки
						throw new Error(err);
					}.bind(this)
				)
			}

			material = new THREE.MeshBasicMaterial()

			diffuseTexture = modelData.diffusetexture ? textureLoader.load(modelData.diffusetexture, loadMesh) : null;
			alphaTexture = modelData.alphatexture ? textureLoader.load(modelData.alphatexture) : null;

			if(modelData.alphatexture != null){
				material.transparent = true;
				(material as THREE.MeshBasicMaterial).depthTest = true;
				(material as THREE.MeshBasicMaterial).depthWrite = true;
				(material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
				material.alphaMap = alphaTexture;
				if(alphaTexture != null){
					alphaTexture.generateMipmaps = false;
					alphaTexture.minFilter = THREE.LinearFilter;
					alphaTexture.magFilter = THREE.LinearFilter;
					alphaTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
					material.alphaMap = alphaTexture;
					material.alphaMap.minFilter = THREE.LinearFilter;
				}
			}

			if(diffuseTexture != null){
				diffuseTexture.generateMipmaps = false;
				diffuseTexture.minFilter = THREE.LinearFilter;
				diffuseTexture.magFilter = THREE.LinearFilter;
				diffuseTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
				material.map = diffuseTexture;
				material.map.minFilter = THREE.LinearFilter;
			}

			this.renderer.capabilities.maxTextureSize = 4096;
			


		}else{

			material = new THREE.MeshPhongMaterial;
			material.Emissive = 5;
		}
	}

	/**
	 * Програмная подсветка элемента по имени
	 * @param {string} name Имя объекта
	 */
	focusModel(name:string){
		
		let object2highlight =  this.sceneObjects.filter((obj:THREE.Object3D) => {
			return obj.name === name;
		});

		if(object2highlight.length){
			this.addHighlightedItem( object2highlight[0] );
			this.outlinepass.selectedObjects = this.selectedObjects
		}
	}

	/**
	 * Програмное удаление подсветки с объекта
	 * @param {string} name Имя объекта
	 */
	blurModel(name:string){
		this.selectedObjects = this.outlinepass.selectedObjects = this.selectedObjects.filter((obj:THREE.Object3D) => {
			return obj.name !== name;
		});
	}

	/**
	 * Проверка наличия пересечений для луча
	 */
	checkIntersection(e:MouseEvent){

		if(this.mousePressed) return;

		let mousePos = new THREE.Vector2(this.mousepos.x, this.mousepos.y);
		this.raycaster.setFromCamera(mousePos, this.camera);
		let intersects = this.raycaster.intersectObject(this.scene, true);
		
		if(intersects.length > 0){

			const selectedObject = intersects[0].object;

			if((selectedObject as any).isInteractive){

				let already:boolean = false;
				let selectedObjectsEmpty = this.selectedObjects.length == 0;
				
				if(!selectedObjectsEmpty){
					already = this.selectedObjects[0].name == selectedObject.name;
				}

				if(!already){
					this.addHighlightedItem( selectedObject );
					this.outlinepass.selectedObjects = this.selectedObjects;
					let data:IHoverData = {
						object : selectedObject,
						mousePos: this.mousepos
					}
					this.triggerEvent("intersect", data);
				}

			}else{
				this.selectedObjects = [];
				this.outlinepass.selectedObjects = this.selectedObjects;
				this.triggerEvent('lost-intersect', e);
			}
		}else{
			this.selectedObjects = [];
			this.outlinepass.selectedObjects = this.selectedObjects;
			this.triggerEvent('lost-intersect');
		}
	}

	/**
	 * Добавление объекта в коллекцию пересечений
	 * @param object {THREE.Intersection} - объект на пересечении луча
	 */
	addHighlightedItem(object:THREE.Object3D){
		this.selectedObjects = [];
		this.selectedObjects.push(object);
	}

	/**
	 * Обработка изменения размеров окна
	 */
	windowResize(){

		let width = this.container.getBoundingClientRect().width;
		let height = this.container.getBoundingClientRect().height;

		this.renderer.setSize(width, height);
		this.camera.aspect = width /height;
		
		this.camera.updateProjectionMatrix();
		this.composer.setSize(width, height);

		let minDistance = 60;
		let maxDistance = 80;
		let minWidth = 1500;
		let maxWidth = 1920;

		let currentWidth = window.innerWidth;		
		let windowPercent = (currentWidth - minWidth) / (maxWidth - minWidth);

		let floorDistance = maxDistance - minDistance;

		let distance = (floorDistance * windowPercent) + minDistance;

		if(distance < minDistance) distance = minDistance;
		if(distance > maxDistance) distance = maxDistance;
		console.log(distance);
		

		this.camera.position.set(0, 20, distance);
		this.camera.lookAt(0,30,0);	
		this.camera.updateWorldMatrix(false, true);
		
		if(this.effectFXAA){
			this.effectFXAA.uniforms[ 'resolution' ].value.set( 
				1 / width, 
				1 / height 
			);
		}

	}

	/**
	 * Создание рендерера
	 */
	makeRenderer(){

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: true
		});

		this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		this.renderer.shadowMap.enabled = true;
		this.renderer.toneMapping = THREE.CineonToneMapping;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	}

	/**
	 * Отображение активного элемента
	 */
	canvasClick(){

		let xdiff = Math.abs(this.mouseStartPos._x - this.mouseEndPos._x);
		let ydiff = Math.abs(this.mouseStartPos._y - this.mouseEndPos._y);

		if (xdiff == 0 && ydiff == 0){

			// Trigger click event
			let activeObject = this.selectedObjects[0];
			if(activeObject){
				this.triggerEvent("object-clicked", activeObject);
			}
		}else{
			this.selectedObjects = [];
		}

	}
}

export default App;