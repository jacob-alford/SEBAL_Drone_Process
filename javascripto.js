const bakeCookie = (...args) => {
  let date = new Date();
  let cookieIngredients = "";
  date.setTime(date.getTime() + 86400000); // One day expiry
  args.forEach(v => cookieIngredients += `${v.name}=${v.value};`);
  cookieIngredients += `expires=${date.toUTCString()};`;
  cookieIngredients += `path=config`;
  return cookieIngredients;
}

$(document).ready(function(){
  $("#configButton").click(() => {
    document.cookie = bakeCookie({name:"cookiesAreEnabled",value:"Yes"});
    window.location.href="config";
  });
});
