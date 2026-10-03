-- Limpia dos avisos del linter de Supabase en la nube.

-- rls_auto_enable() es la función de evento que el dashboard crea para activar RLS en cada tabla nueva de
-- public; no está en estas migraciones y anon y authenticated podían ejecutarla por /rest/v1/rpc. Una
-- función de event trigger no se puede llamar directamente, pero no tiene por qué estar expuesta.
-- En local no existe, por eso el if.
do $$
begin
	if to_regprocedure('public.rls_auto_enable()') is not null then
		revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
	end if;
end
$$;

-- Misma regla de antes; el linter (auth_rls_initplan) solo acepta auth.jwt() dentro de su propio select.
alter policy usuarios_panel_lee_propia on usuarios_panel
	using (id = (select auth.uid()) and ((select auth.jwt()) ->> 'aal') = 'aal2');
