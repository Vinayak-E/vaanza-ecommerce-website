"use strict";!function(){var e=document.querySelector(".comment-editor"),e=(e&&new Quill(e,{modules:{toolbar:".comment-toolbar"},placeholder:"Product Description",theme:"snow"}),document.querySelector("#dropzone-basic")),e=(e&&new Dropzone(e,{previewTemplate:`<div class="dz-preview dz-file-preview">
<div class="dz-details">
  <div class="dz-thumbnail">
    <img data-dz-thumbnail>
    <span class="dz-nopreview">No preview</span>
    <div class="dz-success-mark"></div>
    <div class="dz-error-mark"></div>
    <div class="dz-error-message"><span data-dz-errormessage></span></div>
    <div class="progress">
      <div class="progress-bar progress-bar-primary" role="progressbar" aria-valuemin="0" aria-valuemax="100" data-dz-uploadprogress></div>
    </div>
  </div>
  <div class="dz-filename" data-dz-name></div>
  <div class="dz-size" data-dz-size></div>
</div>
</div>`,parallelUploads:1,maxFilesize:5,acceptedFiles:".jpg,.jpeg,.png,.gif",addRemoveLinks:!0,maxFiles:1}),document.querySelector("#ecommerce-product-tags")),e=(new Tagify(e),new Date),r=document.querySelector(".product-date");r&&r.flatpickr({monthSelectorType:"static",defaultDate:e})}(),$(function(){var s,o,e=$(".select2"),e=(e.length&&e.each(function(){var e=$(this);select2Focus(e),e.wrap('<div class="position-relative"></div>').select2({dropdownParent:e.parent(),placeholder:e.data("placeholder")})}),$(".form-repeater"));e.length&&(s=2,o=1,e.on("submit",function(e){e.preventDefault()}),e.repeater({show:function(){var t=$(this).find(".form-control, .form-select"),a=$(this).find(".form-label"),e=(t.each(function(e){var r="form-repeater-"+s+"-"+o;$(t[e]).attr("id",r),$(a[e]).attr("for",r),o++}),s++,$(this).slideDown(),$(".select2-container").remove(),$(".select2.form-select").select2({placeholder:"Placeholder text"}),$(".select2-container").css("width","100%"),$(this));select2Focus(e),$(".form-repeater:first .form-select").select2({dropdownParent:$(this).parent(),placeholder:"Placeholder text"}),$(".position-relative .select2").each(function(){$(this).select2({dropdownParent:$(this).closest(".position-relative")})})}}))});