let cookieChecker = false;
const bakeCookie = obj => {
  let date = new Date();
  let cookieIngredients = "";
  date.setTime(date.getTime() + 86400000); // One day expiry
  cookieIngredients += `${obj.name}=${obj.value};`;
  cookieIngredients += `expires=${date.toUTCString()};`;
  cookieIngredients += `path=/`;
  return cookieIngredients;
}

$(document).ready(function(){
  $("#successBox,#failBox").hide();
  if(decodeURIComponent(document.cookie).includes("cookiesAreEnabled")) cookieChecker=true;

  $("form").submit(function(event){
    if(cookieChecker){
      $(this).serializeArray().forEach(v => {
        document.cookie = bakeCookie(v);
      });
      $("#successBox").show();
      setTimeout(() => $("#successBox").fadeOut(),1500);
    }else $("#failBox").show();
    event.preventDefault();
  });
});
