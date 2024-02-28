export default class Hyphenate{

	
	constructor(selector:string){

		let e = "[абвгдеёжзийклмнопрстуфхцчшщъыьэюя]";
		let t = "[аеёиоуыэюя]";
		let n = "[бвгджзклмнпрстфхцчшщ]";
		let r = "[йъь]";
		let i = "­";

		var s=new RegExp("("+r+")("+e+e+")","ig");
		var o=new RegExp("("+t+")("+t+e+")","ig");
		var u=new RegExp("("+t+n+")("+n+t+")","ig");
		var a=new RegExp("("+n+t+")("+n+t+")","ig");
		var f=new RegExp("("+t+n+")("+n+n+t+")","ig");
		var l=new RegExp("("+t+n+n+")("+n+n+t+")","ig");

		document.querySelectorAll(selector).forEach((el:HTMLElement) => {
			let e = el.innerHTML;
			e=e.replace(s,"$1"+i+"$2");
			e=e.replace(o,"$1"+i+"$2");
			e=e.replace(u,"$1"+i+"$2");
			e=e.replace(a,"$1"+i+"$2");
			e=e.replace(f,"$1"+i+"$2");
			e=e.replace(l,"$1"+i+"$2");
			el.innerHTML = e;
		})
	}
}