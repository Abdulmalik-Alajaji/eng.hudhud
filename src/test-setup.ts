// بيئة الاختبار (jsdom) لا ترسم canvas: نعيد null بدل رسالة «Not implemented» في كل اختبار.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
