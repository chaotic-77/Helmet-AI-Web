(() => {

const input=document.getElementById("imageUpload");
const preview=document.getElementById("preview");
const sendBtn=document.getElementById("sendBtn");
const result=document.getElementById("result");
const previewHint=document.getElementById("previewHint");
const previewStage=document.getElementById("previewStage");
const topbar=document.getElementById("topbar");

const API_BASE="https://helmet-ai-web-backend.onrender.com";

/* NAVBAR SCROLL */
window.addEventListener("scroll",()=>{
topbar.classList.toggle("scrolled",window.scrollY>60);
});

/* MODALES */
document.querySelectorAll("[data-modal]").forEach(btn=>{
btn.onclick=()=>document.getElementById(btn.dataset.modal).classList.add("active");
});

document.querySelectorAll(".close").forEach(btn=>{
btn.onclick=()=>btn.closest(".modal").classList.remove("active");
});

window.addEventListener("keydown",e=>{
if(e.key==="Escape")
document.querySelectorAll(".modal").forEach(m=>m.classList.remove("active"));
});

/* PREVIEW */
input.addEventListener("change",()=>{
const file=input.files?.[0];
if(!file)return;

preview.src=URL.createObjectURL(file);
preview.style.display="block";
previewHint.style.display="none";
});

/* DETECTOR */
sendBtn.onclick=async()=>{
const file=input.files?.[0];
if(!file){alert("Sube una imagen primero");return;}

sendBtn.disabled=true;
sendBtn.textContent="Analizando...";

const formData=new FormData();
formData.append("image",file);

try{
const resp=await fetch(`${API_BASE}/predict`,{method:"POST",body:formData});
const data=await resp.json();

result.innerHTML=data.detected
? "🟢 Casco detectado"
: "🔴 No se detectó casco";

}catch{
result.innerHTML="🔴 Error de conexión";
}

sendBtn.disabled=false;
sendBtn.textContent="Detectar cascos";
};

})();
