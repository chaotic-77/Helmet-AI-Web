(() => {

const input = document.getElementById("imageUpload");
const preview = document.getElementById("preview");
const sendBtn = document.getElementById("sendBtn");
const result = document.getElementById("result");
const previewHint = document.getElementById("previewHint");
const previewStage = document.getElementById("previewStage");
const topbar = document.getElementById("topbar");

const modalProyecto = document.getElementById("modalProyecto");
const modalManual = document.getElementById("modalManual");

document.getElementById("btnProyecto").onclick=e=>{
e.preventDefault();
modalProyecto.classList.add("active");
};

document.getElementById("btnManual").onclick=e=>{
e.preventDefault();
modalManual.classList.add("active");
};

document.querySelectorAll("[data-close]").forEach(btn=>{
btn.onclick=()=>btn.closest(".modal").classList.remove("active");
});

window.addEventListener("keydown",e=>{
if(e.key==="Escape"){
document.querySelectorAll(".modal").forEach(m=>m.classList.remove("active"));
}
});

window.addEventListener("scroll",()=>{
topbar.classList.toggle("scrolled",window.scrollY>70);
});

input.addEventListener("change",()=>{
const file=input.files[0];
if(!file)return;
const url=URL.createObjectURL(file);
preview.src=url;
preview.style.display="block";
previewHint.style.display="none";
});

sendBtn.addEventListener("click",async()=>{
const file=input.files[0];
if(!file)return alert("Sube imagen primero");

sendBtn.disabled=true;
previewStage.classList.add("scanning");

const formData=new FormData();
formData.append("image",file);

try{
const resp=await fetch("https://helmet-ai-web-backend.onrender.com/predict",{method:"POST",body:formData});
const data=await resp.json();
result.innerHTML=data.detected?"🟢 Casco detectado":"🔴 No se detectó casco";
}catch{
result.innerHTML="Error conectando con servidor";
}

sendBtn.disabled=false;
previewStage.classList.remove("scanning");
});

})();
