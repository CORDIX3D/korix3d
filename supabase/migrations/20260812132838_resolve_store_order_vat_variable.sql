-- Both supported checkout overloads use a local vat_amount variable and a
-- store_orders.vat_amount column. Resolve that single legacy ambiguity at the
-- function level without changing the global PL/pgSQL setting or function ACL.

DO $$
DECLARE
  target_function regprocedure;
  function_definition text;
  patched_definition text;
BEGIN
  FOREACH target_function IN ARRAY ARRAY[
    'public.create_store_order_with_stock(uuid,text,text,text,jsonb,jsonb,numeric,jsonb)'::regprocedure,
    'public.create_store_order_with_stock(uuid,text,text,text,jsonb,jsonb,numeric,text,jsonb)'::regprocedure
  ]
  LOOP
    SELECT pg_get_functiondef(target_function::oid)
    INTO function_definition;

    IF position('#variable_conflict use_variable' IN function_definition) > 0 THEN
      CONTINUE;
    END IF;

    patched_definition := replace(
      function_definition,
      E'AS $function$\r\nDECLARE',
      E'AS $function$\r\n#variable_conflict use_variable\r\nDECLARE'
    );

    IF patched_definition = function_definition THEN
      patched_definition := replace(
        function_definition,
        E'AS $function$\nDECLARE',
        E'AS $function$\n#variable_conflict use_variable\nDECLARE'
      );
    END IF;

    IF patched_definition = function_definition THEN
      RAISE EXCEPTION 'Unable to patch variable conflict directive for %', target_function;
    END IF;

    EXECUTE patched_definition;
  END LOOP;
END $$;
